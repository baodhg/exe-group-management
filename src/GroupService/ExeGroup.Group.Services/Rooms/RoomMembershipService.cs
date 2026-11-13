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
    RoomSeating seating,
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
                var (room, course) = await seating.LoadAsync(roomId, token);
                await seating.EnsureCanEnterAsync(room, course, studentId, token);
                if (room.Status == RoomStatuses.Locked)
                {
                    throw RoomSeating.Conflict(GroupErrorCodes.RoomLocked, "The room is locked: apply to join it.");
                }

                await seating.AddMemberAsync(room, course, studentId, JoinMethods.Open, token);
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
                var (room, course) = await seating.LoadAsync(roomId, token);
                RoomSeating.EnsurePublished(course, clock.UtcNow);
                var members = await rooms.ListActiveMembersAsync(roomId, token);
                var membership = members.SingleOrDefault(member => member.StudentId == studentId)
                    ?? throw RoomSeating.Conflict(GroupErrorCodes.NotRoomMember, "You are not a member of this room.");
                await seating.EndMembershipAsync(room, members, membership, MembershipEndReasons.Left, null, null, token);
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
                    seating.StatusChanged(room);
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
                    await seating.ReopenAsync(room, token);
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
                    ?? throw RoomSeating.Conflict(GroupErrorCodes.NotRoomMember, "The student is not a member of this room.");
                await seating.EndMembershipAsync(room, members, membership, MembershipEndReasons.Removed, note, leaderId, token);
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
                    throw RoomSeating.Conflict(GroupErrorCodes.NotRoomMember, "The new leader must be a member of the room.");
                }

                room.LeaderId = studentId;
                seating.LeaderChanged(room);
                return Task.CompletedTask;
            },
            cancellationToken);
        return await roomService.GetAsync(roomId, cancellationToken);
    }

    private async Task RunAsLeaderAsync(Guid roomId, Func<Room, List<RoomMember>, Guid, CancellationToken, Task> action, CancellationToken cancellationToken)
    {
        var leaderId = currentUser.RequireUserId();
        await transactions.ExecuteWithConflictRetryAsync(
            async token =>
            {
                var (room, course) = await seating.LoadAsync(roomId, token);
                if (room.LeaderId != leaderId)
                {
                    throw RoomService.NotLeader();
                }

                RoomSeating.EnsurePublished(course, clock.UtcNow);
                await action(room, await rooms.ListActiveMembersAsync(roomId, token), leaderId, token);
                await rooms.SaveChangesAsync(token);
                return true;
            },
            cancellationToken);
    }
}
