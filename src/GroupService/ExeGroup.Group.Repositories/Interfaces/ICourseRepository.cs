using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.Repositories.Interfaces;

public sealed class CourseRow
{
    public required Course Course { get; init; }

    public required string SemesterCode { get; init; }

    public required string SubjectCode { get; init; }

    public required string SubjectName { get; init; }

    public int StudentCount { get; init; }

    public int RoomCount { get; init; }
}

public sealed record CourseFilter(Guid? SemesterId, Guid? SubjectId, string? Phase, Guid? EnrolledStudentId, Guid? LecturerId);

public interface ICourseRepository
{
    Task<PagedResult<CourseRow>> GetPageAsync(ListQuery query, CourseFilter filter, CancellationToken cancellationToken);

    Task<CourseRow?> FindRowAsync(Guid courseId, CancellationToken cancellationToken);

    Task<Course?> FindAsync(Guid courseId, CancellationToken cancellationToken);

    Task<List<Guid>> ListDueToPublishAsync(DateTime now, CancellationToken cancellationToken);

    Task<List<Guid>> ListDueToExpireAsync(DateTime now, CancellationToken cancellationToken);

    Task<bool> ClassCodeExistsAsync(Guid semesterId, Guid subjectId, string classCode, Guid? exceptCourseId, CancellationToken cancellationToken);

    Task<bool> IsEnrolledAsync(Guid courseId, Guid studentId, CancellationToken cancellationToken);

    Task<bool> SemesterExistsAsync(Guid semesterId, CancellationToken cancellationToken);

    Task<bool> SubjectExistsAsync(Guid subjectId, CancellationToken cancellationToken);

    Task RemoveWithRoomsAndEnrollmentsAsync(Course course, CancellationToken cancellationToken);

    void Add(Course course);

    Task SaveChangesAsync(CancellationToken cancellationToken);

    Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken);
}
