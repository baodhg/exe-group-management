using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using ExeGroup.Group.Services.Events;

namespace ExeGroup.Group.Services.Rooms;

public interface IRoomMembershipService
{
    Task<RoomDetailModel> JoinAsync(Guid roomId, CancellationToken cancellationToken);

    Task<RoomDetailModel> LeaveAsync(Guid roomId, CancellationToken cancellationToken);

    Task<RoomDetailModel> LockAsync(Guid roomId, CancellationToken cancellationToken);

    Task<RoomDetailModel> UnlockAsync(Guid roomId, CancellationToken cancellationToken);

    Task<RoomDetailModel> RemoveMemberAsync(Guid roomId, Guid studentId, string reason, CancellationToken cancellationToken);

    Task<RoomDetailModel> HandOverAsync(Guid roomId, Guid studentId, CancellationToken cancellationToken);
}

public sealed class RoomMembershipService(
    IRoomRepository rooms,
    IRoomService roomService,
    RequestCloser requests,
    IOutbox outbox,
    ITransactionRunner transactions,
    ICurrentUser currentUser,
    IClock clock) : IRoomMembershipService
{
    public const int MaxRemovalNoteLength = 300;

    public async Task<RoomDetailModel> JoinAsync(Guid roomId, CancellationToken cancellationToken)
    {
        var studentId = currentUser.RequireUserId();
        await transactions.ExecuteWithConflictRetryAsync(
            async token =>
            {
                var (room, course) = await LoadAsync(roomId, token);
                await EnsureCanEnterAsync(room, course, studentId, token);
                if (room.Status == RoomStatuses.Locked)
                {
                    throw Conflict(GroupErrorCodes.RoomLocked, "The room is locked: apply to join it.");
                }

                await AddMemberAsync(room, course, studentId, JoinMethods.Open, token);
                await rooms.SaveChangesAsync(token);
                return true;
            },
            cancellationToken);
        return await roomService.GetAsync(roomId, cancellationToken);
    }

    public async Task<RoomDetailModel> LeaveAsync(Guid roomId, CancellationToken cancellationToken)
    {
        var studentId = currentUser.RequireUserId();
        await transactions.ExecuteWithConflictRetryAsync(
            async token =>
            {
                var (room, course) = await LoadAsync(roomId, token);
                EnsurePublished(course);
                var members = await rooms.ListActiveMembersAsync(roomId, token);
                var membership = members.SingleOrDefault(member => member.StudentId == studentId)
                    ?? throw Conflict(GroupErrorCodes.NotRoomMember, "You are not a member of this room.");
                await EndMembershipAsync(room, members, membership, MembershipEndReasons.Left, null, null, token);
                await rooms.SaveChangesAsync(token);
                return true;
            },
            cancellationToken);
        return await roomService.GetAsync(roomId, cancellationToken);
    }

    public async Task<RoomDetailModel> LockAsync(Guid roomId, CancellationToken cancellationToken)
    {
        await RunAsLeaderAsync(
            roomId,
            (room, _, _, _) =>
            {
                if (room.Status != RoomStatuses.Locked)
                {
                    room.Status = RoomStatuses.Locked;
                    room.LockedAt = clock.UtcNow;
                    StatusChanged(room);
                }

                return Task.CompletedTask;
            },
            cancellationToken);
        return await roomService.GetAsync(roomId, cancellationToken);
    }

    public async Task<RoomDetailModel> UnlockAsync(Guid roomId, CancellationToken cancellationToken)
    {
        await RunAsLeaderAsync(
            roomId,
            async (room, _, _, token) =>
            {
                if (room.Status == RoomStatuses.Locked)
                {
                    await ReopenAsync(room, token);
                }
            },
            cancellationToken);
        return await roomService.GetAsync(roomId, cancellationToken);
    }

    public async Task<RoomDetailModel> RemoveMemberAsync(Guid roomId, Guid studentId, string reason, CancellationToken cancellationToken)
    {
        var note = reason.Trim();
        if (note.Length is 0 or > MaxRemovalNoteLength)
        {
            throw new ValidationFailedException("reason", $"Give a reason of 1 to {MaxRemovalNoteLength} characters.");
        }

        await RunAsLeaderAsync(
            roomId,
            async (room, members, leaderId, token) =>
            {
                if (studentId == leaderId)
                {
                    throw new ValidationFailedException("studentId", "Leave the room instead of removing yourself.");
                }

                var membership = members.SingleOrDefault(member => member.StudentId == studentId)
                    ?? throw Conflict(GroupErrorCodes.NotRoomMember, "The student is not a member of this room.");
                await EndMembershipAsync(room, members, membership, MembershipEndReasons.Removed, note, leaderId, token);
            },
            cancellationToken);
        return await roomService.GetAsync(roomId, cancellationToken);
    }

    public async Task<RoomDetailModel> HandOverAsync(Guid roomId, Guid studentId, CancellationToken cancellationToken)
    {
        await RunAsLeaderAsync(
            roomId,
            (room, members, leaderId, _) =>
            {
                if (studentId == leaderId)
                {
                    return Task.CompletedTask;
                }

                if (members.All(member => member.StudentId != studentId))
                {
                    throw Conflict(GroupErrorCodes.NotRoomMember, "The new leader must be a member of the room.");
                }

                room.LeaderId = studentId;
                LeaderChanged(room);
                return Task.CompletedTask;
            },
            cancellationToken);
        return await roomService.GetAsync(roomId, cancellationToken);
    }

    internal async Task AddMemberAsync(Room room, Course course, Guid studentId, string joinedVia, CancellationToken cancellationToken)
    {
        var majorId = await rooms.FindMajorAsync(course.SemesterId, studentId, cancellationToken)
            ?? throw Conflict(GroupErrorCodes.NotEnrolled, "The student is not on the course roster.");
        if (room.MemberCount >= room.Capacity)
        {
            throw Conflict(GroupErrorCodes.RoomFull, "The room has no free seat.");
        }

        var rules = await rooms.GetRulesAsync(room.GroupTypeId, cancellationToken);
        var majors = await rooms.ListMemberMajorsAsync(room, cancellationToken);
        if (!RoomComposition.CanAdd(room.Capacity, majors, majorId, rules))
        {
            throw Conflict(GroupErrorCodes.CompositionRule, "Joining would leave too few seats for the majors this group type still needs.");
        }

        rooms.Add(new RoomMember
        {
            MembershipId = Guid.NewGuid(),
            RoomId = room.RoomId,
            CourseId = room.CourseId,
            StudentId = studentId,
            JoinedVia = joinedVia,
            JoinedAt = clock.UtcNow,
        });
        room.MemberCount++;
        var becameLeader = room.LeaderId is null;
        room.LeaderId ??= studentId;
        outbox.Enqueue(
            GroupEventTypes.RoomMemberJoined,
            room.RoomId,
            new RoomMemberJoinedEvent(room.CourseId, room.RoomId, room.Name, studentId, joinedVia, room.LeaderId));
        if (becameLeader)
        {
            LeaderChanged(room);
        }

        await requests.CloseAsync(await rooms.ListPendingForStudentAsync(room.CourseId, studentId, cancellationToken), JoinRequestReasons.JoinedAnotherRoom, null, cancellationToken);
        if (room.MemberCount >= room.Capacity)
        {
            await requests.CloseAsync(await rooms.ListPendingForRoomAsync(room.RoomId, cancellationToken), JoinRequestReasons.RoomFull, null, cancellationToken);
        }
    }

    internal async Task EnsureCanEnterAsync(Room room, Course course, Guid studentId, CancellationToken cancellationToken)
    {
        EnsurePublished(course);
        if (!await rooms.IsEnrolledAsync(course.CourseId, studentId, cancellationToken))
        {
            throw Conflict(GroupErrorCodes.NotEnrolled, "You are not on the course roster.");
        }

        if (await rooms.FindActiveMembershipAsync(course.CourseId, studentId, cancellationToken) is not null)
        {
            throw Conflict(GroupErrorCodes.AlreadyInRoom, "You are already in a room of this course.");
        }

        if (await rooms.WasRemovedFromRoomAsync(room.RoomId, studentId, cancellationToken))
        {
            throw Conflict(GroupErrorCodes.RemovedFromRoom, "The leader removed you from this room; you cannot join it again.");
        }
    }

    internal static void EnsurePublished(Course course)
    {
        if (course.Phase != CoursePhases.Published)
        {
            throw Conflict(GroupErrorCodes.CourseNotPublished, "Students join, leave and apply only while the course is published.");
        }
    }

    internal static ConflictException Conflict(string code, string message) => new(code, message);

    private async Task RunAsLeaderAsync(Guid roomId, Func<Room, List<RoomMember>, Guid, CancellationToken, Task> action, CancellationToken cancellationToken)
    {
        var leaderId = currentUser.RequireUserId();
        await transactions.ExecuteWithConflictRetryAsync(
            async token =>
            {
                var (room, course) = await LoadAsync(roomId, token);
                if (room.LeaderId != leaderId)
                {
                    throw RoomService.NotLeader();
                }

                EnsurePublished(course);
                await action(room, await rooms.ListActiveMembersAsync(roomId, token), leaderId, token);
                await rooms.SaveChangesAsync(token);
                return true;
            },
            cancellationToken);
    }

    private async Task<(Room Room, Course Course)> LoadAsync(Guid roomId, CancellationToken cancellationToken)
    {
        var room = await rooms.FindAsync(roomId, cancellationToken) ?? throw new NotFoundException("Room", roomId);
        var course = await rooms.FindCourseAsync(room.CourseId, cancellationToken) ?? throw new NotFoundException("Course", room.CourseId);
        return (room, course);
    }

    private async Task EndMembershipAsync(
        Room room,
        List<RoomMember> members,
        RoomMember membership,
        string reason,
        string? note,
        Guid? endedBy,
        CancellationToken cancellationToken)
    {
        membership.EndedAt = clock.UtcNow;
        membership.EndReason = reason;
        membership.EndNote = note;
        membership.EndedBy = endedBy;
        room.MemberCount--;
        outbox.Enqueue(
            GroupEventTypes.RoomMemberLeft,
            room.RoomId,
            new RoomMemberLeftEvent(room.CourseId, room.RoomId, room.Name, membership.StudentId, reason, note));
        if (room.LeaderId == membership.StudentId)
        {
            room.LeaderId = members.Where(member => member.StudentId != membership.StudentId).OrderBy(member => member.JoinedAt).FirstOrDefault()?.StudentId;
            LeaderChanged(room);
        }

        if (room.MemberCount == 0 && room.Status == RoomStatuses.Locked)
        {
            await ReopenAsync(room, cancellationToken);
        }
    }

    private async Task ReopenAsync(Room room, CancellationToken cancellationToken)
    {
        room.Status = RoomStatuses.Open;
        room.LockedAt = null;
        StatusChanged(room);
        await requests.CloseAsync(await rooms.ListPendingForRoomAsync(room.RoomId, cancellationToken), JoinRequestReasons.RoomReopened, null, cancellationToken);
    }

    private void LeaderChanged(Room room) =>
        outbox.Enqueue(GroupEventTypes.RoomLeaderChanged, room.RoomId, new RoomLeaderChangedEvent(room.CourseId, room.RoomId, room.Name, room.LeaderId));

    private void StatusChanged(Room room) =>
        outbox.Enqueue(GroupEventTypes.RoomStatusChanged, room.RoomId, new RoomStatusChangedEvent(room.CourseId, room.RoomId, room.Name, room.Status));
}
