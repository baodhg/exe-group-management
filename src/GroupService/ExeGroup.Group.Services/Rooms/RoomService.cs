using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;

namespace ExeGroup.Group.Services.Rooms;

public sealed record RoomSummaryModel(
    Guid Id,
    Guid CourseId,
    string Name,
    string? Topic,
    string Status,
    int Capacity,
    int MemberCount,
    Guid GroupTypeId,
    string GroupTypeCode,
    Guid? LeaderId,
    string? LeaderName,
    int? GroupNo)
{
    public int FreeSeats => Math.Max(0, Capacity - MemberCount);
}

public sealed record RoomSkillModel(string SkillCode, byte Level);

public sealed record RoomMemberModel(
    Guid StudentId,
    string StudentCode,
    string FullName,
    Guid MajorId,
    string MajorCode,
    DateTime JoinedAt,
    string JoinedVia,
    bool IsLeader,
    IReadOnlyList<RoomSkillModel> Skills);

public sealed record MajorCountModel(Guid MajorId, string MajorCode, int Members, int Required);

public sealed record RoomDetailModel(
    RoomSummaryModel Summary,
    string GroupTypeName,
    int MinGroupSize,
    int MinDistinctMajors,
    bool Eligible,
    IReadOnlyList<MajorCountModel> Majors,
    IReadOnlyList<RoomMemberModel> Members);

public sealed record RoomChanges(string? Name, string? Topic, Guid? GroupTypeId);

public sealed record RoomListFilter(string? Status, bool? HasSeat, Guid? GroupTypeId);

public interface IRoomService
{
    Task<PagedResult<RoomSummaryModel>> ListAsync(Guid courseId, RoomListFilter filter, ListQuery query, CancellationToken cancellationToken);

    Task<RoomDetailModel> GetAsync(Guid roomId, CancellationToken cancellationToken);

    Task<RoomDetailModel> UpdateAsync(Guid roomId, RoomChanges changes, CancellationToken cancellationToken);
}

public sealed class RoomService(IRoomRepository rooms, ICurrentUser currentUser) : IRoomService
{
    private static readonly string[] Statuses = [RoomStatuses.Open, RoomStatuses.Locked, RoomStatuses.Finalized];

    public async Task<PagedResult<RoomSummaryModel>> ListAsync(Guid courseId, RoomListFilter filter, ListQuery query, CancellationToken cancellationToken)
    {
        var course = await rooms.FindCourseAsync(courseId, cancellationToken) ?? throw new NotFoundException("Course", courseId);
        await EnsureCanReadAsync(course, cancellationToken);
        string? status = null;
        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            status = Statuses.FirstOrDefault(known => string.Equals(known, filter.Status.Trim(), StringComparison.OrdinalIgnoreCase))
                ?? throw new ValidationFailedException("status", $"Status must be one of {string.Join(", ", Statuses)}.");
        }

        return (await rooms.GetPageAsync(courseId, new RoomFilter(status, filter.HasSeat, filter.GroupTypeId), query, cancellationToken)).Map(ToSummary);
    }

    public async Task<RoomDetailModel> GetAsync(Guid roomId, CancellationToken cancellationToken)
    {
        var row = await rooms.FindRowAsync(roomId, cancellationToken) ?? throw new NotFoundException("Room", roomId);
        var course = await rooms.FindCourseAsync(row.Room.CourseId, cancellationToken) ?? throw new NotFoundException("Course", row.Room.CourseId);
        await EnsureCanReadAsync(course, cancellationToken);
        return await DetailAsync(row, course, cancellationToken);
    }

    public async Task<RoomDetailModel> UpdateAsync(Guid roomId, RoomChanges changes, CancellationToken cancellationToken)
    {
        var room = await rooms.FindAsync(roomId, cancellationToken) ?? throw new NotFoundException("Room", roomId);
        var course = await rooms.FindCourseAsync(room.CourseId, cancellationToken) ?? throw new NotFoundException("Course", room.CourseId);
        if (course.Phase == CoursePhases.Finalized)
        {
            throw new ConflictException(GroupErrorCodes.CourseFinalized, "Rooms of a finalized course cannot change.");
        }

        var topic = changes.Topic is null ? room.Topic : NullIfBlank(changes.Topic);
        if (currentUser.IsInRole(Roles.Administrator))
        {
            await ApplyAdministratorChangesAsync(room, course, changes, cancellationToken);
        }
        else if (room.LeaderId != currentUser.RequireUserId())
        {
            throw NotLeader();
        }
        else if ((changes.Name is not null && changes.Name.Trim() != room.Name) || (changes.GroupTypeId is not null && changes.GroupTypeId != room.GroupTypeId))
        {
            throw new ForbiddenException("Only administrators rename rooms or change their group type.", GroupErrorCodes.NotRoomLeader);
        }

        room.Topic = topic;
        if (!await rooms.TrySaveChangesAsync(cancellationToken))
        {
            throw new ConflictException(GroupErrorCodes.RoomNameTaken, $"The course already has a room named '{room.Name}'.");
        }

        return await GetAsync(roomId, cancellationToken);
    }

    public static ForbiddenException NotLeader() => new("Only the room leader can do this.", GroupErrorCodes.NotRoomLeader);

    private async Task ApplyAdministratorChangesAsync(Room room, Course course, RoomChanges changes, CancellationToken cancellationToken)
    {
        var name = changes.Name?.Trim() ?? room.Name;
        var groupTypeId = changes.GroupTypeId ?? room.GroupTypeId;
        if (name == room.Name && groupTypeId == room.GroupTypeId)
        {
            return;
        }

        if (course.Phase != CoursePhases.Setup)
        {
            throw new ConflictException(GroupErrorCodes.CourseNotInSetup, "Rooms are renamed or retyped only while the course is in Setup.");
        }

        if (name.Length == 0)
        {
            throw new ValidationFailedException("name", "A room needs a name.");
        }

        if (groupTypeId != room.GroupTypeId && !await rooms.IsGroupTypeAllowedAsync(room.SemesterId, groupTypeId, cancellationToken))
        {
            throw new ValidationFailedException("groupTypeId", "This group type is not allowed in the course's semester.");
        }

        if (await rooms.NameExistsAsync(room.CourseId, name, room.RoomId, cancellationToken))
        {
            throw new ConflictException(GroupErrorCodes.RoomNameTaken, $"The course already has a room named '{name}'.");
        }

        room.Name = name;
        room.GroupTypeId = groupTypeId;
    }

    private async Task EnsureCanReadAsync(Course course, CancellationToken cancellationToken)
    {
        if (currentUser.IsInRole(Roles.Administrator))
        {
            return;
        }

        var userId = currentUser.RequireUserId();
        if (course.LecturerId == userId || await rooms.IsEnrolledAsync(course.CourseId, userId, cancellationToken))
        {
            return;
        }

        throw new ForbiddenException("Only the course's students, its lecturer and administrators can see its rooms.");
    }

    private async Task<RoomDetailModel> DetailAsync(RoomRow row, Course course, CancellationToken cancellationToken)
    {
        var rules = await rooms.GetRulesAsync(row.Room.GroupTypeId, cancellationToken);
        var members = await rooms.ListMemberProfilesAsync(row.Room, cancellationToken);
        var majors = members.Select(member => member.MajorId).ToList();
        var majorCodes = members.GroupBy(member => member.MajorId).ToDictionary(group => group.Key, group => group.First().MajorCode);
        foreach (var (majorId, code) in rules.MajorCodes)
        {
            majorCodes.TryAdd(majorId, code);
        }

        return new RoomDetailModel(
            ToSummary(row),
            rules.Name,
            course.MinGroupSize,
            rules.MinDistinctMajors,
            RoomComposition.IsEligible(course.MinGroupSize, majors, rules),
            majorCodes
                .Select(pair => new MajorCountModel(pair.Key, pair.Value, majors.Count(major => major == pair.Key), rules.MinPerMajor.GetValueOrDefault(pair.Key)))
                .OrderBy(major => major.MajorCode, StringComparer.Ordinal)
                .ToList(),
            members
                .Select(member => new RoomMemberModel(
                    member.StudentId,
                    member.StudentCode,
                    member.FullName,
                    member.MajorId,
                    member.MajorCode,
                    member.JoinedAt,
                    member.JoinedVia,
                    member.StudentId == row.Room.LeaderId,
                    member.Skills.Select(skill => new RoomSkillModel(skill.SkillCode, skill.Level)).ToList()))
                .ToList());
    }

    internal static RoomSummaryModel ToSummary(RoomRow row) =>
        new(
            row.Room.RoomId,
            row.Room.CourseId,
            row.Room.Name,
            row.Room.Topic,
            row.Room.Status,
            row.Room.Capacity,
            row.Room.MemberCount,
            row.Room.GroupTypeId,
            row.GroupTypeCode,
            row.Room.LeaderId,
            row.LeaderName,
            row.Room.GroupNo);

    private static string? NullIfBlank(string value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
