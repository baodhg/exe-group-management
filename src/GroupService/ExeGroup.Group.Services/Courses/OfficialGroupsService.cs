using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using ExeGroup.Group.Services.Events;
using ExeGroup.Group.Services.Rooms;

namespace ExeGroup.Group.Services.Courses;

public sealed record OfficialGroupMemberModel(
    Guid StudentId,
    string StudentCode,
    string FullName,
    string MajorCode,
    bool IsLeader);

public sealed record OfficialGroupModel(
    int GroupNo,
    Guid RoomId,
    string RoomName,
    string? Topic,
    string GroupTypeCode,
    string GroupTypeName,
    Guid? LeaderId,
    string? LeaderName,
    int MemberCount,
    int Capacity,
    bool Eligible,
    IReadOnlyList<OfficialGroupMemberModel> Members)
{
    public bool TopicMissing => string.IsNullOrWhiteSpace(Topic);
}

public sealed record OfficialGroupsModel(
    Guid CourseId,
    string CourseName,
    string Phase,
    IReadOnlyList<OfficialGroupModel> Groups);

public sealed record MissingTopicModel(
    Guid RoomId,
    string RoomName,
    int GroupNo,
    Guid? LeaderId,
    string? LeaderName);

public sealed record MissingTopicsModel(
    Guid CourseId,
    string CourseName,
    string Phase,
    IReadOnlyList<MissingTopicModel> Groups);

public sealed record TopicRequestModel(
    Guid CourseId,
    Guid RoomId,
    string RoomName,
    int GroupNo,
    string? Note,
    Guid RequestedBy,
    Guid LeaderId);

public interface IOfficialGroupsService
{
    Task<OfficialGroupsModel> GetAsync(Guid courseId, CancellationToken cancellationToken);

    Task<MissingTopicsModel> ListMissingTopicsAsync(Guid courseId, CancellationToken cancellationToken);

    Task<OfficialGroupModel> SetTopicAsync(Guid courseId, Guid roomId, string topic, CancellationToken cancellationToken);

    Task<OfficialGroupModel> ClearTopicAsync(Guid courseId, Guid roomId, CancellationToken cancellationToken);

    Task<TopicRequestModel> RequestTopicAsync(Guid courseId, Guid roomId, string? note, CancellationToken cancellationToken);

    Task<OfficialGroupModel> SetTopicByLeaderAsync(Guid courseId, Guid roomId, string topic, CancellationToken cancellationToken);
}

public sealed class OfficialGroupsService(
    IRoomRepository rooms,
    IOutbox outbox,
    ITransactionRunner transactions,
    ICurrentUser currentUser) : IOfficialGroupsService
{
    public const int MaxTopicLength = 200;
    public const int MaxNoteLength = 500;

    public async Task<OfficialGroupsModel> GetAsync(Guid courseId, CancellationToken cancellationToken)
    {
        var course = await LoadCourseAsync(courseId, cancellationToken);
        await EnsureCanManageAsync(course, cancellationToken);
        var groups = await BuildGroupsAsync(course, cancellationToken);
        return new OfficialGroupsModel(course.CourseId, course.ClassCode, course.Phase, groups);
    }

    public async Task<MissingTopicsModel> ListMissingTopicsAsync(Guid courseId, CancellationToken cancellationToken)
    {
        var course = await LoadCourseAsync(courseId, cancellationToken);
        await EnsureCanManageAsync(course, cancellationToken);
        var groups = await BuildGroupsAsync(course, cancellationToken);
        var missing = groups
            .Where(group => group.TopicMissing)
            .Select(group => new MissingTopicModel(group.RoomId, group.RoomName, group.GroupNo, group.LeaderId, group.LeaderName))
            .ToList();
        return new MissingTopicsModel(course.CourseId, course.ClassCode, course.Phase, missing);
    }

    public async Task<OfficialGroupModel> SetTopicAsync(Guid courseId, Guid roomId, string topic, CancellationToken cancellationToken)
    {
        var text = Required(topic, MaxTopicLength);
        var course = await LoadCourseAsync(courseId, cancellationToken);
        await EnsureCanManageAsync(course, cancellationToken);
        EnsureFinalized(course);
        var userId = currentUser.RequireUserId();
        await transactions.ExecuteWithConflictRetryAsync(
            async token =>
            {
                var room = await LoadRoomAsync(courseId, roomId, token);
                if (!string.IsNullOrWhiteSpace(room.Topic))
                {
                    throw new ConflictException(GroupErrorCodes.TopicAlreadySet, "This group already has a topic; clear it before setting a new one.");
                }

                room.Topic = text;
                outbox.Enqueue(
                    GroupEventTypes.TopicSet,
                    room.RoomId,
                    new TopicSetEvent(course.CourseId, room.RoomId, room.Name, text, userId, room.LeaderId, course.LecturerId));
                await rooms.SaveChangesAsync(token);
                return true;
            },
            cancellationToken);
        return await GetGroupAsync(courseId, roomId, cancellationToken);
    }

    public async Task<OfficialGroupModel> ClearTopicAsync(Guid courseId, Guid roomId, CancellationToken cancellationToken)
    {
        var course = await LoadCourseAsync(courseId, cancellationToken);
        await EnsureCanManageAsync(course, cancellationToken);
        EnsureFinalized(course);
        var userId = currentUser.RequireUserId();
        await transactions.ExecuteWithConflictRetryAsync(
            async token =>
            {
                var room = await LoadRoomAsync(courseId, roomId, token);
                room.Topic = null;
                outbox.Enqueue(
                    GroupEventTypes.TopicSet,
                    room.RoomId,
                    new TopicSetEvent(course.CourseId, room.RoomId, room.Name, null, userId, room.LeaderId, course.LecturerId));
                await rooms.SaveChangesAsync(token);
                return true;
            },
            cancellationToken);
        return await GetGroupAsync(courseId, roomId, cancellationToken);
    }

    public async Task<TopicRequestModel> RequestTopicAsync(Guid courseId, Guid roomId, string? note, CancellationToken cancellationToken)
    {
        var text = Optional(note, MaxNoteLength);
        var course = await LoadCourseAsync(courseId, cancellationToken);
        await EnsureCanManageAsync(course, cancellationToken);
        EnsureFinalized(course);
        var requesterId = currentUser.RequireUserId();
        TopicRequestModel result = default!;
        await transactions.ExecuteWithConflictRetryAsync(
            async token =>
            {
                var room = await LoadRoomAsync(courseId, roomId, token);
                if (!string.IsNullOrWhiteSpace(room.Topic))
                {
                    throw new ConflictException(GroupErrorCodes.TopicAlreadySet, "This group already has a topic; there is nothing to ask for.");
                }

                if (room.LeaderId is not { } leaderId)
                {
                    throw new ConflictException(GroupErrorCodes.NoRoomLeader, "This group has no leader to ask for a topic.");
                }

                outbox.Enqueue(
                    GroupEventTypes.TopicRequested,
                    room.RoomId,
                    new TopicRequestedEvent(course.CourseId, room.RoomId, room.Name, text, requesterId, leaderId, course.LecturerId));
                await rooms.SaveChangesAsync(token);
                result = new TopicRequestModel(course.CourseId, room.RoomId, room.Name, room.GroupNo ?? 0, text, requesterId, leaderId);
                return true;
            },
            cancellationToken);
        return result;
    }

    public async Task<OfficialGroupModel> SetTopicByLeaderAsync(Guid courseId, Guid roomId, string topic, CancellationToken cancellationToken)
    {
        var text = Required(topic, MaxTopicLength);
        var course = await LoadCourseAsync(courseId, cancellationToken);
        EnsureFinalized(course);
        var userId = currentUser.RequireUserId();
        await transactions.ExecuteWithConflictRetryAsync(
            async token =>
            {
                var room = await LoadRoomAsync(courseId, roomId, token);
                if (room.LeaderId != userId)
                {
                    throw new ForbiddenException("Only the leader of the group can set its topic.", GroupErrorCodes.NotRoomLeader);
                }

                if (!string.IsNullOrWhiteSpace(room.Topic))
                {
                    throw new ConflictException(GroupErrorCodes.TopicAlreadySet, "This group already has a topic; clear it before setting a new one.");
                }

                room.Topic = text;
                outbox.Enqueue(
                    GroupEventTypes.TopicSet,
                    room.RoomId,
                    new TopicSetEvent(course.CourseId, room.RoomId, room.Name, text, userId, room.LeaderId, course.LecturerId));
                await rooms.SaveChangesAsync(token);
                return true;
            },
            cancellationToken);
        return await GetGroupAsync(courseId, roomId, cancellationToken);
    }

    private async Task<Course> LoadCourseAsync(Guid courseId, CancellationToken cancellationToken) =>
        await rooms.FindCourseAsync(courseId, cancellationToken) ?? throw new NotFoundException("Course", courseId);

    private async Task<Room> LoadRoomAsync(Guid courseId, Guid roomId, CancellationToken cancellationToken)
    {
        var room = await rooms.FindAsync(roomId, cancellationToken) ?? throw new NotFoundException("Room", roomId);
        if (room.CourseId != courseId)
        {
            throw new NotFoundException("Room", roomId);
        }

        return room;
    }

    private async Task EnsureCanManageAsync(Course course, CancellationToken cancellationToken)
    {
        if (currentUser.IsInRole(Roles.Administrator))
        {
            return;
        }

        if (currentUser.IsInRole(Roles.Lecturer) && course.LecturerId == currentUser.RequireUserId())
        {
            return;
        }

        await Task.CompletedTask;
        throw new ForbiddenException("Only the lecturer of the course and administrators can manage its groups.");
    }

    private static void EnsureFinalized(Course course)
    {
        if (course.Phase != CoursePhases.Finalized)
        {
            throw new ConflictException(GroupErrorCodes.CourseNotFinalized, "The topics of the groups are completed once the course is finalized.");
        }
    }

    private async Task<OfficialGroupModel> GetGroupAsync(Guid courseId, Guid roomId, CancellationToken cancellationToken)
    {
        var groups = await BuildGroupsAsync(await LoadCourseAsync(courseId, cancellationToken), cancellationToken);
        return groups.SingleOrDefault(group => group.RoomId == roomId) ?? throw new NotFoundException("Room", roomId);
    }

    private async Task<List<OfficialGroupModel>> BuildGroupsAsync(Course course, CancellationToken cancellationToken)
    {
        var rows = await rooms.ListRowsAsync(course.CourseId, cancellationToken);
        var rules = new Dictionary<Guid, GroupTypeRules>();
        foreach (var groupTypeId in rows.Select(row => row.Room.GroupTypeId).Distinct())
        {
            rules[groupTypeId] = await rooms.GetRulesAsync(groupTypeId, cancellationToken);
        }

        var groups = new List<OfficialGroupModel>();
        foreach (var row in rows.OrderBy(row => row.Room.GroupNo ?? int.MaxValue).ThenBy(row => row.Room.Name, StringComparer.Ordinal))
        {
            var members = await rooms.ListMemberProfilesAsync(row.Room, cancellationToken);
            var rule = rules[row.Room.GroupTypeId];
            var majors = members.Select(member => member.MajorId).ToList();
            groups.Add(new OfficialGroupModel(
                row.Room.GroupNo ?? 0,
                row.Room.RoomId,
                row.Room.Name,
                row.Room.Topic,
                row.GroupTypeCode,
                rule.Name,
                row.Room.LeaderId,
                row.LeaderName,
                members.Count,
                row.Room.Capacity,
                members.Count <= course.MaxGroupSize && RoomComposition.IsEligible(course.MinGroupSize, majors, rule),
                members
                    .Select(member => new OfficialGroupMemberModel(
                        member.StudentId,
                        member.StudentCode,
                        member.FullName,
                        member.MajorCode,
                        member.StudentId == row.Room.LeaderId))
                    .ToList()));
        }

        return groups;
    }

    private static string Required(string? value, int maxLength)
    {
        var text = value?.Trim();
        if (string.IsNullOrEmpty(text))
        {
            throw new ValidationFailedException("topic", "This field is required.");
        }

        return text.Length <= maxLength
            ? text
            : throw new ValidationFailedException("topic", $"Use at most {maxLength} characters.");
    }

    private static string? Optional(string? value, int maxLength)
    {
        var text = value?.Trim();
        if (string.IsNullOrEmpty(text))
        {
            return null;
        }

        return text.Length <= maxLength
            ? text
            : throw new ValidationFailedException("note", $"Use at most {maxLength} characters.");
    }
}
