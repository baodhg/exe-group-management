using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Data;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Group.Repositories.Repositories;

public sealed class CourseRepository(GroupDbContext context) : ICourseRepository
{
    private static readonly SortMap<CourseRow> Sorting = new SortMap<CourseRow>()
        .Add("classCode", row => row.Course.ClassCode)
        .Add("subjectCode", row => row.SubjectCode)
        .Add("semesterCode", row => row.SemesterCode)
        .Add("phase", row => row.Course.Phase)
        .Add("publishAt", row => row.Course.PublishAt)
        .Add("expireAt", row => row.Course.ExpireAt)
        .Add("studentCount", row => row.StudentCount)
        .ByDefault("classCode")
        .TieBreaker(row => row.Course.CourseId);

    public Task<PagedResult<CourseRow>> GetPageAsync(ListQuery query, CourseFilter filter, CancellationToken cancellationToken)
    {
        var courses = context.Courses.AsNoTracking();
        if (filter.SemesterId is { } semesterId)
        {
            courses = courses.Where(course => course.SemesterId == semesterId);
        }

        if (filter.SubjectId is { } subjectId)
        {
            courses = courses.Where(course => course.SubjectId == subjectId);
        }

        if (filter.Phase is { } phase)
        {
            courses = courses.Where(course => course.Phase == phase);
        }

        if (filter.EnrolledStudentId is { } studentId)
        {
            courses = courses.Where(course => context.CourseEnrollments.Any(enrollment => enrollment.CourseId == course.CourseId && enrollment.StudentId == studentId));
        }

        if (filter.LecturerId is { } lecturerId)
        {
            courses = courses.Where(course => course.LecturerId == lecturerId);
        }

        var rows = Rows(courses);
        if (query.Search is { } search)
        {
            rows = rows.Where(row => row.Course.ClassCode.Contains(search) || row.SubjectCode.Contains(search) || row.SubjectName.Contains(search));
        }

        return rows.ToPagedResultAsync(query, Sorting, cancellationToken);
    }

    public Task<CourseRow?> FindRowAsync(Guid courseId, CancellationToken cancellationToken) =>
        Rows(context.Courses.AsNoTracking().Where(course => course.CourseId == courseId)).SingleOrDefaultAsync(cancellationToken);

    public Task<Course?> FindAsync(Guid courseId, CancellationToken cancellationToken) =>
        context.Courses.SingleOrDefaultAsync(course => course.CourseId == courseId, cancellationToken);

    public Task<bool> ClassCodeExistsAsync(Guid semesterId, Guid subjectId, string classCode, Guid? exceptCourseId, CancellationToken cancellationToken) =>
        context.Courses.AnyAsync(
            course => course.SemesterId == semesterId && course.SubjectId == subjectId && course.ClassCode == classCode && course.CourseId != exceptCourseId,
            cancellationToken);

    public Task<bool> IsEnrolledAsync(Guid courseId, Guid studentId, CancellationToken cancellationToken) =>
        context.CourseEnrollments.AnyAsync(enrollment => enrollment.CourseId == courseId && enrollment.StudentId == studentId, cancellationToken);

    public Task<bool> SemesterExistsAsync(Guid semesterId, CancellationToken cancellationToken) =>
        context.Semesters.AnyAsync(semester => semester.SemesterId == semesterId, cancellationToken);

    public Task<bool> SubjectExistsAsync(Guid subjectId, CancellationToken cancellationToken) =>
        context.Subjects.AnyAsync(subject => subject.SubjectId == subjectId, cancellationToken);

    public async Task RemoveWithRoomsAndEnrollmentsAsync(Course course, CancellationToken cancellationToken)
    {
        context.Rooms.RemoveRange(await context.Rooms.Where(room => room.CourseId == course.CourseId).ToListAsync(cancellationToken));
        context.CourseEnrollments.RemoveRange(await context.CourseEnrollments.Where(enrollment => enrollment.CourseId == course.CourseId).ToListAsync(cancellationToken));
        context.Courses.Remove(course);
    }

    public void Add(Course course) => context.Courses.Add(course);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);

    public Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken) => context.TrySaveChangesAsync(cancellationToken);

    private IQueryable<CourseRow> Rows(IQueryable<Course> courses) =>
        from course in courses
        join semester in context.Semesters on course.SemesterId equals semester.SemesterId
        join subject in context.Subjects on course.SubjectId equals subject.SubjectId
        select new CourseRow
        {
            Course = course,
            SemesterCode = semester.Code,
            SubjectCode = subject.Code,
            SubjectName = subject.Name,
            StudentCount = context.CourseEnrollments.Count(enrollment => enrollment.CourseId == course.CourseId),
            RoomCount = context.Rooms.Count(room => room.CourseId == course.CourseId),
        };
}
