using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.Repositories.Interfaces;

public sealed class RoomRow
{
    public required Room Room { get; init; }

    public required string GroupTypeCode { get; init; }

    public string? LeaderName { get; init; }
}

public sealed record RoomFilter(string? Status, bool? HasSeat, Guid? GroupTypeId);

public sealed record MemberProfile(
    Guid StudentId,
    string StudentCode,
    string FullName,
    Guid MajorId,
    string MajorCode,
    DateTime JoinedAt,
    string JoinedVia,
    IReadOnlyList<(string SkillCode, byte Level)> Skills);

public sealed record GroupTypeRules(
    Guid GroupTypeId,
    string Code,
    string Name,
    int MinDistinctMajors,
    IReadOnlyDictionary<Guid, int> MinPerMajor,
    IReadOnlyDictionary<Guid, string> MajorCodes);

public sealed record CourseStudentProfile(
    Guid StudentId,
    string StudentCode,
    string FullName,
    Guid MajorId,
    string MajorCode,
    Guid? RoomId,
    IReadOnlyDictionary<string, int> Skills);

public interface IRoomRepository
{
    Task<PagedResult<RoomRow>> GetPageAsync(Guid courseId, RoomFilter filter, ListQuery query, CancellationToken cancellationToken);

    Task<RoomRow?> FindRowAsync(Guid roomId, CancellationToken cancellationToken);

    Task<List<RoomRow>> ListRowsWithSeatAsync(Guid courseId, CancellationToken cancellationToken);

    Task<List<CourseStudentProfile>> ListCourseStudentsAsync(Course course, CancellationToken cancellationToken);

    Task<List<Guid>> ListRoomsRemovedFromAsync(Guid courseId, Guid studentId, CancellationToken cancellationToken);

    Task<Room?> FindAsync(Guid roomId, CancellationToken cancellationToken);

    Task<Course?> FindCourseAsync(Guid courseId, CancellationToken cancellationToken);

    Task<List<MemberProfile>> ListMemberProfilesAsync(Room room, CancellationToken cancellationToken);

    Task<List<RoomMember>> ListActiveMembersAsync(Guid roomId, CancellationToken cancellationToken);

    Task<RoomMember?> FindActiveMembershipAsync(Guid courseId, Guid studentId, CancellationToken cancellationToken);

    Task<bool> WasRemovedFromRoomAsync(Guid roomId, Guid studentId, CancellationToken cancellationToken);

    Task<bool> IsEnrolledAsync(Guid courseId, Guid studentId, CancellationToken cancellationToken);

    Task<Guid?> FindMajorAsync(Guid semesterId, Guid studentId, CancellationToken cancellationToken);

    Task<List<Guid>> ListMemberMajorsAsync(Room room, CancellationToken cancellationToken);

    Task<GroupTypeRules> GetRulesAsync(Guid groupTypeId, CancellationToken cancellationToken);

    Task<bool> IsGroupTypeAllowedAsync(Guid semesterId, Guid groupTypeId, CancellationToken cancellationToken);

    Task<bool> NameExistsAsync(Guid courseId, string name, Guid exceptRoomId, CancellationToken cancellationToken);

    Task<List<JoinRequest>> ListPendingForRoomAsync(Guid roomId, CancellationToken cancellationToken);

    Task<List<JoinRequest>> ListPendingForStudentAsync(Guid courseId, Guid studentId, CancellationToken cancellationToken);

    Task<Dictionary<Guid, string>> FindRoomNamesAsync(IReadOnlyCollection<Guid> roomIds, CancellationToken cancellationToken);

    void Add(RoomMember member);

    Task SaveChangesAsync(CancellationToken cancellationToken);

    Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken);
}
