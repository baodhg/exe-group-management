using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.Repositories.Interfaces;

public sealed class SemesterStudentRow
{
    public required SemesterStudent Student { get; init; }

    public required string MajorCode { get; init; }

    public required string MajorName { get; init; }

    public int CourseCount { get; init; }
}

public sealed class RosterRow
{
    public required SemesterStudent Student { get; init; }

    public required string MajorCode { get; init; }

    public DateTime EnrolledAt { get; init; }

    public Guid? RoomId { get; init; }

    public string? RoomName { get; init; }
}

public interface IRosterRepository
{
    Task<PagedResult<SemesterStudentRow>> GetSemesterStudentsAsync(Guid semesterId, Guid? majorId, ListQuery query, CancellationToken cancellationToken);

    Task<List<SemesterStudent>> FindSemesterStudentsAsync(Guid semesterId, IReadOnlyCollection<Guid> studentIds, CancellationToken cancellationToken);

    Task<List<Guid>> FindExistingMajorIdsAsync(IReadOnlyCollection<Guid> majorIds, CancellationToken cancellationToken);

    Task<List<Guid>> FindStudentsInRoomsAsync(Guid semesterId, IReadOnlyCollection<Guid> studentIds, CancellationToken cancellationToken);

    Task<bool> IsEnrolledInSemesterAsync(Guid semesterId, Guid studentId, CancellationToken cancellationToken);

    Task RemoveSemesterStudentAsync(SemesterStudent student, CancellationToken cancellationToken);

    Task<PagedResult<RosterRow>> GetRosterAsync(Guid courseId, Guid? majorId, bool? hasRoom, ListQuery query, CancellationToken cancellationToken);

    Task<List<Guid>> FindEnrolledIdsAsync(Guid courseId, IReadOnlyCollection<Guid> studentIds, CancellationToken cancellationToken);

    Task<CourseEnrollment?> FindEnrollmentAsync(Guid courseId, Guid studentId, CancellationToken cancellationToken);

    Task<bool> HasRoomHistoryAsync(Guid courseId, Guid studentId, CancellationToken cancellationToken);

    Task RemoveEnrollmentAsync(CourseEnrollment enrollment, CancellationToken cancellationToken);

    Task<SemesterStudent?> FindWithSkillsAsync(Guid semesterId, Guid studentId, CancellationToken cancellationToken);

    Task<Dictionary<Guid, Skill>> FindSkillsAsync(IReadOnlyCollection<Guid> skillIds, CancellationToken cancellationToken);

    Task<Major?> FindMajorAsync(Guid majorId, CancellationToken cancellationToken);

    Task<bool> HasClosedCourseAsync(Guid semesterId, Guid studentId, DateTime now, CancellationToken cancellationToken);

    void RemoveSkill(StudentSkill skill);

    void Add(SemesterStudent student);

    void Add(CourseEnrollment enrollment);

    Task SaveChangesAsync(CancellationToken cancellationToken);

    Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken);
}
