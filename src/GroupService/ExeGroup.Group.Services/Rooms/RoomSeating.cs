using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using ExeGroup.Group.Services.Events;

namespace ExeGroup.Group.Services.Rooms;

public sealed class RoomSeating(IRoomRepository rooms, RequestCloser requests, IOutbox outbox, IClock clock)
{
    public static void EnsurePublished(Course course)
    {
        if (course.Phase != CoursePhases.Published)
        {
            throw Conflict(GroupErrorCodes.CourseNotPublished, "Students join, leave and apply only while the course is published.");
        }
    }

    public static ConflictException Conflict(string code, string message) => new(code, message);

    public async Task<(Room Room, Course Course)> LoadAsync(Guid roomId, CancellationToken cancellationToken)
    {
        var room = await rooms.FindAsync(roomId, cancellationToken) ?? throw new NotFoundException("Room", roomId);
        var course = await rooms.FindCourseAsync(room.CourseId, cancellationToken) ?? throw new NotFoundException("Course", room.CourseId);
        return (room, course);
    }

    public async Task EnsureCanEnterAsync(Room room, Course course, Guid studentId, CancellationToken cancellationToken)
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

    public async Task<string?> SeatProblemAsync(Room room, Course course, Guid studentId, CancellationToken cancellationToken)
    {
        if (room.MemberCount >= room.Capacity)
        {
            return GroupErrorCodes.RoomFull;
        }

        var majorId = await rooms.FindMajorAsync(course.SemesterId, studentId, cancellationToken);
        if (majorId is null)
        {
            return GroupErrorCodes.NotEnrolled;
        }

        var rules = await rooms.GetRulesAsync(room.GroupTypeId, cancellationToken);
        var majors = await rooms.ListMemberMajorsAsync(room, cancellationToken);
        return RoomComposition.CanAdd(room.Capacity, majors, majorId.Value, rules) ? null : GroupErrorCodes.CompositionRule;
    }

    public async Task EnsureSeatAsync(Room room, Course course, Guid studentId, CancellationToken cancellationToken)
    {
        switch (await SeatProblemAsync(room, course, studentId, cancellationToken))
        {
            case null:
                return;
            case GroupErrorCodes.RoomFull:
                throw Conflict(GroupErrorCodes.RoomFull, "The room has no free seat.");
            case GroupErrorCodes.CompositionRule:
                throw Conflict(GroupErrorCodes.CompositionRule, "Joining would leave too few seats for the majors this group type still needs.");
            case var code:
                throw Conflict(code, "The student is not on the course roster.");
        }
    }

    public async Task AddMemberAsync(Room room, Course course, Guid studentId, string joinedVia, CancellationToken cancellationToken)
    {
        await EnsureSeatAsync(room, course, studentId, cancellationToken);
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

    public void LeaderChanged(Room room) =>
        outbox.Enqueue(GroupEventTypes.RoomLeaderChanged, room.RoomId, new RoomLeaderChangedEvent(room.CourseId, room.RoomId, room.Name, room.LeaderId));

    public void StatusChanged(Room room) =>
        outbox.Enqueue(GroupEventTypes.RoomStatusChanged, room.RoomId, new RoomStatusChangedEvent(room.CourseId, room.RoomId, room.Name, room.Status));
}
