using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;

namespace ExeGroup.Group.Services.Rosters;

public sealed record SemesterStudentModel(
    Guid StudentId,
    string StudentCode,
    string FullName,
    string Email,
    Guid MajorId,
    string MajorCode,
    string MajorName,
    DateTime AddedAt,
    int CourseCount);

public sealed record SemesterStudentInput(Guid StudentId, string StudentCode, string FullName, string Email, Guid MajorId);

public sealed record SemesterStudentsSaved(int Added, int Updated);

public sealed record RosterEntryModel(
    Guid StudentId,
    string StudentCode,
    string FullName,
    string Email,
    Guid MajorId,
    string MajorCode,
    DateTime EnrolledAt,
    Guid? RoomId,
    string? RoomName);

public sealed record EnrollmentResult(int Enrolled, int AlreadyEnrolled);

public interface IRosterService
{
    Task<PagedResult<SemesterStudentModel>> ListSemesterStudentsAsync(Guid semesterId, Guid? majorId, ListQuery query, CancellationToken cancellationToken);

    Task<SemesterStudentsSaved> SaveSemesterStudentsAsync(Guid semesterId, IReadOnlyList<SemesterStudentInput> students, CancellationToken cancellationToken);

    Task RemoveSemesterStudentAsync(Guid semesterId, Guid studentId, CancellationToken cancellationToken);

    Task<PagedResult<RosterEntryModel>> ListRosterAsync(Guid courseId, Guid? majorId, bool? hasRoom, ListQuery query, CancellationToken cancellationToken);

    Task<EnrollmentResult> EnrollAsync(Guid courseId, IReadOnlyList<Guid> studentIds, CancellationToken cancellationToken);

    Task UnenrollAsync(Guid courseId, Guid studentId, CancellationToken cancellationToken);
}

public sealed class RosterService(
    IRosterRepository rosters,
    ISemesterRepository semesters,
    ICourseRepository courses,
    ICurrentUser currentUser) : IRosterService
{
    public async Task<PagedResult<SemesterStudentModel>> ListSemesterStudentsAsync(Guid semesterId, Guid? majorId, ListQuery query, CancellationToken cancellationToken)
    {
        await RequireSemesterAsync(semesterId, cancellationToken);
        return (await rosters.GetSemesterStudentsAsync(semesterId, majorId, query, cancellationToken)).Map(row => new SemesterStudentModel(
            row.Student.StudentId,
            row.Student.StudentCode,
            row.Student.FullName,
            row.Student.Email,
            row.Student.MajorId,
            row.MajorCode,
            row.MajorName,
            row.Student.AddedAt,
            row.CourseCount));
    }

    public async Task<SemesterStudentsSaved> SaveSemesterStudentsAsync(Guid semesterId, IReadOnlyList<SemesterStudentInput> students, CancellationToken cancellationToken)
    {
        await RequireSemesterAsync(semesterId, cancellationToken);
        if (students.Count == 0)
        {
            throw new ValidationFailedException("students", "Give at least one student.");
        }

        var rows = students
            .Select(student => student with
            {
                StudentCode = student.StudentCode.Trim().ToUpperInvariant(),
                FullName = student.FullName.Trim(),
                Email = student.Email.Trim().ToLowerInvariant(),
            })
            .ToList();
        EnsureUnique(rows.Select(row => row.StudentId.ToString()), "studentId");
        EnsureUnique(rows.Select(row => row.StudentCode), "studentCode");
        var majorIds = rows.Select(row => row.MajorId).Distinct().ToList();
        var knownMajors = await rosters.FindExistingMajorIdsAsync(majorIds, cancellationToken);
        var unknownMajor = majorIds.Except(knownMajors).FirstOrDefault();
        if (unknownMajor != Guid.Empty)
        {
            throw new ValidationFailedException("majorId", $"Major '{unknownMajor}' does not exist.");
        }

        var existing = (await rosters.FindSemesterStudentsAsync(semesterId, rows.Select(row => row.StudentId).ToList(), cancellationToken))
            .ToDictionary(student => student.StudentId);
        var changingMajor = rows.Where(row => existing.TryGetValue(row.StudentId, out var student) && student.MajorId != row.MajorId)
            .Select(row => row.StudentId)
            .ToList();
        if (changingMajor.Count > 0 && (await rosters.FindStudentsInRoomsAsync(semesterId, changingMajor, cancellationToken)).Count > 0)
        {
            throw new ConflictException(GroupErrorCodes.StudentMajorLocked, "A student already in a room cannot change major in this semester.");
        }

        foreach (var row in rows)
        {
            if (existing.TryGetValue(row.StudentId, out var student))
            {
                student.StudentCode = row.StudentCode;
                student.FullName = row.FullName;
                student.Email = row.Email;
                student.MajorId = row.MajorId;
                continue;
            }

            rosters.Add(new SemesterStudent
            {
                SemesterId = semesterId,
                StudentId = row.StudentId,
                StudentCode = row.StudentCode,
                FullName = row.FullName,
                Email = row.Email,
                MajorId = row.MajorId,
            });
        }

        await rosters.SaveChangesAsync(cancellationToken);
        return new SemesterStudentsSaved(rows.Count - existing.Count, existing.Count);
    }

    public async Task RemoveSemesterStudentAsync(Guid semesterId, Guid studentId, CancellationToken cancellationToken)
    {
        var student = (await rosters.FindSemesterStudentsAsync(semesterId, [studentId], cancellationToken)).SingleOrDefault()
            ?? throw new NotFoundException("Semester student", studentId);
        if (await rosters.IsEnrolledInSemesterAsync(semesterId, studentId, cancellationToken))
        {
            throw new ConflictException(GroupErrorCodes.StudentEnrolled, "Remove the student from their courses first.");
        }

        await rosters.RemoveSemesterStudentAsync(student, cancellationToken);
        await rosters.SaveChangesAsync(cancellationToken);
    }

    public async Task<PagedResult<RosterEntryModel>> ListRosterAsync(Guid courseId, Guid? majorId, bool? hasRoom, ListQuery query, CancellationToken cancellationToken)
    {
        var course = await RequireCourseAsync(courseId, cancellationToken);
        if (!currentUser.IsInRole(Roles.Administrator) && course.LecturerId != currentUser.RequireUserId())
        {
            throw new ForbiddenException("Only the course's lecturer and administrators can read its roster.");
        }

        return (await rosters.GetRosterAsync(courseId, majorId, hasRoom, query, cancellationToken)).Map(row => new RosterEntryModel(
            row.Student.StudentId,
            row.Student.StudentCode,
            row.Student.FullName,
            row.Student.Email,
            row.Student.MajorId,
            row.MajorCode,
            row.EnrolledAt,
            row.RoomId,
            row.RoomName));
    }

    public async Task<EnrollmentResult> EnrollAsync(Guid courseId, IReadOnlyList<Guid> studentIds, CancellationToken cancellationToken)
    {
        var course = await RequireCourseAsync(courseId, cancellationToken);
        EnsureNotFinalized(course);
        var ids = studentIds.Distinct().ToList();
        if (ids.Count == 0)
        {
            throw new ValidationFailedException("studentIds", "Give at least one student.");
        }

        var inSemester = (await rosters.FindSemesterStudentsAsync(course.SemesterId, ids, cancellationToken)).Select(student => student.StudentId).ToHashSet();
        var outside = ids.Where(id => !inSemester.Contains(id)).ToList();
        if (outside.Count > 0)
        {
            throw new ConflictException(GroupErrorCodes.StudentNotInSemester, $"{outside.Count} student(s) are not in this course's semester.");
        }

        var enrolled = (await rosters.FindEnrolledIdsAsync(courseId, ids, cancellationToken)).ToHashSet();
        foreach (var id in ids.Where(id => !enrolled.Contains(id)))
        {
            rosters.Add(new CourseEnrollment { CourseId = courseId, SemesterId = course.SemesterId, StudentId = id });
        }

        await rosters.SaveChangesAsync(cancellationToken);
        return new EnrollmentResult(ids.Count - enrolled.Count, enrolled.Count);
    }

    public async Task UnenrollAsync(Guid courseId, Guid studentId, CancellationToken cancellationToken)
    {
        var course = await RequireCourseAsync(courseId, cancellationToken);
        EnsureNotFinalized(course);
        var enrollment = await rosters.FindEnrollmentAsync(courseId, studentId, cancellationToken)
            ?? throw new NotFoundException("Enrollment", studentId);
        if (await rosters.HasRoomHistoryAsync(courseId, studentId, cancellationToken))
        {
            throw new ConflictException(GroupErrorCodes.StudentInRoom, "A student who has been in a room of this course cannot be removed from it.");
        }

        await rosters.RemoveEnrollmentAsync(enrollment, cancellationToken);
        await rosters.SaveChangesAsync(cancellationToken);
    }

    private async Task RequireSemesterAsync(Guid semesterId, CancellationToken cancellationToken)
    {
        if (await semesters.FindAsync(semesterId, cancellationToken) is null)
        {
            throw new NotFoundException("Semester", semesterId);
        }
    }

    private async Task<Course> RequireCourseAsync(Guid courseId, CancellationToken cancellationToken) =>
        await courses.FindAsync(courseId, cancellationToken) ?? throw new NotFoundException("Course", courseId);

    private static void EnsureNotFinalized(Course course)
    {
        if (course.Phase == CoursePhases.Finalized)
        {
            throw new ConflictException(GroupErrorCodes.CourseFinalized, "A finalized course cannot change its roster.");
        }
    }

    private static void EnsureUnique(IEnumerable<string> values, string field)
    {
        var duplicate = values.GroupBy(value => value, StringComparer.OrdinalIgnoreCase).FirstOrDefault(group => group.Count() > 1);
        if (duplicate is not null)
        {
            throw new ValidationFailedException(field, $"'{duplicate.Key}' appears more than once.");
        }
    }
}
