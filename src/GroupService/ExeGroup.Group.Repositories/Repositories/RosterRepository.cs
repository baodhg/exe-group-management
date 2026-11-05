using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Data;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Group.Repositories.Repositories;

public sealed class RosterRepository(GroupDbContext context) : IRosterRepository
{
    private static readonly SortMap<SemesterStudentRow> StudentSorting = new SortMap<SemesterStudentRow>()
        .Add("studentCode", row => row.Student.StudentCode)
        .Add("fullName", row => row.Student.FullName)
        .Add("email", row => row.Student.Email)
        .Add("majorCode", row => row.MajorCode)
        .Add("addedAt", row => row.Student.AddedAt)
        .ByDefault("studentCode")
        .TieBreaker(row => row.Student.StudentId);

    private static readonly SortMap<RosterRow> RosterSorting = new SortMap<RosterRow>()
        .Add("studentCode", row => row.Student.StudentCode)
        .Add("fullName", row => row.Student.FullName)
        .Add("majorCode", row => row.MajorCode)
        .Add("enrolledAt", row => row.EnrolledAt)
        .Add("roomName", row => row.RoomName)
        .ByDefault("studentCode")
        .TieBreaker(row => row.Student.StudentId);

    public Task<PagedResult<SemesterStudentRow>> GetSemesterStudentsAsync(Guid semesterId, Guid? majorId, ListQuery query, CancellationToken cancellationToken)
    {
        var students = context.SemesterStudents.AsNoTracking().Where(student => student.SemesterId == semesterId);
        if (majorId is { } major)
        {
            students = students.Where(student => student.MajorId == major);
        }

        if (query.Search is { } search)
        {
            students = students.Where(student => student.StudentCode.Contains(search) || student.FullName.Contains(search) || student.Email.Contains(search));
        }

        var rows =
            from student in students
            join majorRow in context.Majors on student.MajorId equals majorRow.MajorId
            select new SemesterStudentRow
            {
                Student = student,
                MajorCode = majorRow.Code,
                MajorName = majorRow.Name,
                CourseCount = context.CourseEnrollments.Count(enrollment => enrollment.SemesterId == semesterId && enrollment.StudentId == student.StudentId),
            };
        return rows.ToPagedResultAsync(query, StudentSorting, cancellationToken);
    }

    public Task<List<SemesterStudent>> FindSemesterStudentsAsync(Guid semesterId, IReadOnlyCollection<Guid> studentIds, CancellationToken cancellationToken) =>
        context.SemesterStudents.Where(student => student.SemesterId == semesterId && studentIds.Contains(student.StudentId)).ToListAsync(cancellationToken);

    public Task<List<Guid>> FindExistingMajorIdsAsync(IReadOnlyCollection<Guid> majorIds, CancellationToken cancellationToken) =>
        context.Majors.Where(major => majorIds.Contains(major.MajorId)).Select(major => major.MajorId).ToListAsync(cancellationToken);

    public Task<List<Guid>> FindStudentsInRoomsAsync(Guid semesterId, IReadOnlyCollection<Guid> studentIds, CancellationToken cancellationToken) =>
        context.RoomMembers
            .Where(member => member.EndedAt == null && studentIds.Contains(member.StudentId)
                && context.Courses.Any(course => course.CourseId == member.CourseId && course.SemesterId == semesterId))
            .Select(member => member.StudentId)
            .Distinct()
            .ToListAsync(cancellationToken);

    public Task<bool> IsEnrolledInSemesterAsync(Guid semesterId, Guid studentId, CancellationToken cancellationToken) =>
        context.CourseEnrollments.AnyAsync(enrollment => enrollment.SemesterId == semesterId && enrollment.StudentId == studentId, cancellationToken);

    public async Task RemoveSemesterStudentAsync(SemesterStudent student, CancellationToken cancellationToken)
    {
        context.StudentSkills.RemoveRange(await context.StudentSkills
            .Where(skill => skill.SemesterId == student.SemesterId && skill.StudentId == student.StudentId)
            .ToListAsync(cancellationToken));
        context.SemesterStudents.Remove(student);
    }

    public Task<PagedResult<RosterRow>> GetRosterAsync(Guid courseId, Guid? majorId, bool? hasRoom, ListQuery query, CancellationToken cancellationToken)
    {
        var rows =
            from enrollment in context.CourseEnrollments.AsNoTracking()
            where enrollment.CourseId == courseId
            join student in context.SemesterStudents on new { enrollment.SemesterId, enrollment.StudentId } equals new { student.SemesterId, student.StudentId }
            join major in context.Majors on student.MajorId equals major.MajorId
            select new RosterRow
            {
                Student = student,
                MajorCode = major.Code,
                EnrolledAt = enrollment.EnrolledAt,
                RoomId = context.RoomMembers
                    .Where(member => member.CourseId == courseId && member.StudentId == enrollment.StudentId && member.EndedAt == null)
                    .Select(member => (Guid?)member.RoomId)
                    .FirstOrDefault(),
                RoomName = (
                    from member in context.RoomMembers
                    where member.CourseId == courseId && member.StudentId == enrollment.StudentId && member.EndedAt == null
                    join room in context.Rooms on member.RoomId equals room.RoomId
                    select room.Name).FirstOrDefault(),
            };
        if (majorId is { } filterMajorId)
        {
            rows = rows.Where(row => row.Student.MajorId == filterMajorId);
        }

        if (hasRoom is { } withRoom)
        {
            rows = withRoom ? rows.Where(row => row.RoomId != null) : rows.Where(row => row.RoomId == null);
        }

        if (query.Search is { } search)
        {
            rows = rows.Where(row => row.Student.StudentCode.Contains(search) || row.Student.FullName.Contains(search) || row.Student.Email.Contains(search));
        }

        return rows.ToPagedResultAsync(query, RosterSorting, cancellationToken);
    }

    public Task<List<Guid>> FindEnrolledIdsAsync(Guid courseId, IReadOnlyCollection<Guid> studentIds, CancellationToken cancellationToken) =>
        context.CourseEnrollments.Where(enrollment => enrollment.CourseId == courseId && studentIds.Contains(enrollment.StudentId))
            .Select(enrollment => enrollment.StudentId)
            .ToListAsync(cancellationToken);

    public Task<CourseEnrollment?> FindEnrollmentAsync(Guid courseId, Guid studentId, CancellationToken cancellationToken) =>
        context.CourseEnrollments.SingleOrDefaultAsync(enrollment => enrollment.CourseId == courseId && enrollment.StudentId == studentId, cancellationToken);

    public Task<bool> HasRoomHistoryAsync(Guid courseId, Guid studentId, CancellationToken cancellationToken) =>
        context.RoomMembers.AnyAsync(member => member.CourseId == courseId && member.StudentId == studentId, cancellationToken);

    public async Task RemoveEnrollmentAsync(CourseEnrollment enrollment, CancellationToken cancellationToken)
    {
        context.JoinRequests.RemoveRange(await context.JoinRequests
            .Where(request => request.CourseId == enrollment.CourseId && request.StudentId == enrollment.StudentId)
            .ToListAsync(cancellationToken));
        context.CourseEnrollments.Remove(enrollment);
    }

    public void Add(SemesterStudent student) => context.SemesterStudents.Add(student);

    public void Add(CourseEnrollment enrollment) => context.CourseEnrollments.Add(enrollment);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);

    public Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken) => context.TrySaveChangesAsync(cancellationToken);
}
