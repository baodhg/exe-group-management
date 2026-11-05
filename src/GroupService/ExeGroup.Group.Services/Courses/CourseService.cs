using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;

namespace ExeGroup.Group.Services.Courses;

public sealed record CourseModel(
    Guid Id,
    Guid SemesterId,
    string SemesterCode,
    Guid SubjectId,
    string SubjectCode,
    string SubjectName,
    string ClassCode,
    Guid? LecturerId,
    string? LecturerName,
    int MinGroupSize,
    int MaxGroupSize,
    decimal RoomFactor,
    string Phase,
    DateTime? PublishAt,
    DateTime? ExpireAt,
    DateTime? FinalizedAt,
    int StudentCount,
    int RoomCount);

public sealed record CourseSettings(
    string ClassCode,
    Guid? LecturerId,
    string? LecturerName,
    int MinGroupSize,
    int MaxGroupSize,
    decimal RoomFactor,
    DateTime? PublishAt,
    DateTime? ExpireAt);

public sealed record CourseListFilter(Guid? SemesterId, Guid? SubjectId, string? Phase, bool Mine);

public interface ICourseService
{
    Task<PagedResult<CourseModel>> ListAsync(ListQuery query, CourseListFilter filter, CancellationToken cancellationToken);

    Task<CourseModel> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<CourseModel> CreateAsync(Guid semesterId, Guid subjectId, CourseSettings settings, CancellationToken cancellationToken);

    Task<CourseModel> UpdateAsync(Guid id, CourseSettings settings, CancellationToken cancellationToken);

    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
}

public sealed class CourseService(ICourseRepository courses, ICurrentUser currentUser, IClock clock) : ICourseService
{
    public const decimal MaxRoomFactor = 9.99m;

    private static readonly string[] Phases = [CoursePhases.Setup, CoursePhases.Published, CoursePhases.Expired, CoursePhases.Finalized];

    public async Task<PagedResult<CourseModel>> ListAsync(ListQuery query, CourseListFilter filter, CancellationToken cancellationToken)
    {
        string? phase = null;
        if (!string.IsNullOrWhiteSpace(filter.Phase))
        {
            phase = Phases.FirstOrDefault(known => string.Equals(known, filter.Phase.Trim(), StringComparison.OrdinalIgnoreCase))
                ?? throw new ValidationFailedException("phase", $"Phase must be one of {string.Join(", ", Phases)}.");
        }

        Guid? enrolledStudentId = null;
        Guid? lecturerId = null;
        if (filter.Mine && !currentUser.IsInRole(Roles.Administrator))
        {
            var userId = currentUser.RequireUserId();
            if (currentUser.IsInRole(Roles.Lecturer))
            {
                lecturerId = userId;
            }
            else
            {
                enrolledStudentId = userId;
            }
        }

        var page = await courses.GetPageAsync(query, new CourseFilter(filter.SemesterId, filter.SubjectId, phase, enrolledStudentId, lecturerId), cancellationToken);
        return page.Map(ToModel);
    }

    public async Task<CourseModel> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var row = await courses.FindRowAsync(id, cancellationToken) ?? throw new NotFoundException("Course", id);
        await EnsureCanReadAsync(row.Course, cancellationToken);
        return ToModel(row);
    }

    public async Task<CourseModel> CreateAsync(Guid semesterId, Guid subjectId, CourseSettings settings, CancellationToken cancellationToken)
    {
        settings = Normalize(settings);
        if (!await courses.SemesterExistsAsync(semesterId, cancellationToken))
        {
            throw new ValidationFailedException("semesterId", "The semester does not exist.");
        }

        if (!await courses.SubjectExistsAsync(subjectId, cancellationToken))
        {
            throw new ValidationFailedException("subjectId", "The subject does not exist.");
        }

        await EnsureClassIsFreeAsync(semesterId, subjectId, settings.ClassCode, null, cancellationToken);
        var course = new Course { CourseId = Guid.NewGuid(), SemesterId = semesterId, SubjectId = subjectId };
        Apply(course, settings);
        courses.Add(course);
        await SaveAsync(settings.ClassCode, cancellationToken);
        return await GetRowAsync(course.CourseId, cancellationToken);
    }

    public async Task<CourseModel> UpdateAsync(Guid id, CourseSettings settings, CancellationToken cancellationToken)
    {
        settings = Normalize(settings);
        var course = await RequireAsync(id, cancellationToken);
        if (course.Phase == CoursePhases.Finalized)
        {
            throw new ConflictException(GroupErrorCodes.CourseFinalized, "A finalized course cannot change.");
        }

        if (course.Phase != CoursePhases.Setup)
        {
            var lockedChanged = settings.ClassCode != course.ClassCode
                || settings.MinGroupSize != course.MinGroupSize
                || settings.MaxGroupSize != course.MaxGroupSize
                || settings.RoomFactor != course.RoomFactor
                || settings.PublishAt != course.PublishAt;
            if (lockedChanged)
            {
                throw new ConflictException(GroupErrorCodes.CourseNotInSetup, "Only the lecturer and a later deadline can change after the course is published.");
            }

            if (settings.ExpireAt != course.ExpireAt)
            {
                var later = settings.ExpireAt is { } newExpireAt
                    && course.Phase == CoursePhases.Published
                    && newExpireAt > clock.UtcNow
                    && (course.ExpireAt is null || newExpireAt > course.ExpireAt);
                if (!later)
                {
                    throw new ConflictException(GroupErrorCodes.CourseScheduleLocked, "While the course is published the deadline can only move later.");
                }
            }
        }

        await EnsureClassIsFreeAsync(course.SemesterId, course.SubjectId, settings.ClassCode, id, cancellationToken);
        Apply(course, settings);
        await SaveAsync(settings.ClassCode, cancellationToken);
        return await GetRowAsync(id, cancellationToken);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var course = await RequireAsync(id, cancellationToken);
        if (course.Phase != CoursePhases.Setup)
        {
            throw new ConflictException(GroupErrorCodes.CourseNotInSetup, "A course can be deleted only in Setup.");
        }

        await courses.RemoveWithRoomsAndEnrollmentsAsync(course, cancellationToken);
        await courses.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureCanReadAsync(Course course, CancellationToken cancellationToken)
    {
        if (currentUser.IsInRole(Roles.Administrator))
        {
            return;
        }

        var userId = currentUser.RequireUserId();
        if (course.LecturerId == userId || await courses.IsEnrolledAsync(course.CourseId, userId, cancellationToken))
        {
            return;
        }

        throw new ForbiddenException("Only the course's students, its lecturer and administrators can open it.");
    }

    private async Task<Course> RequireAsync(Guid id, CancellationToken cancellationToken) =>
        await courses.FindAsync(id, cancellationToken) ?? throw new NotFoundException("Course", id);

    private async Task<CourseModel> GetRowAsync(Guid id, CancellationToken cancellationToken) =>
        ToModel(await courses.FindRowAsync(id, cancellationToken) ?? throw new NotFoundException("Course", id));

    private async Task EnsureClassIsFreeAsync(Guid semesterId, Guid subjectId, string classCode, Guid? exceptId, CancellationToken cancellationToken)
    {
        if (await courses.ClassCodeExistsAsync(semesterId, subjectId, classCode, exceptId, cancellationToken))
        {
            throw ClassTaken(classCode);
        }
    }

    private async Task SaveAsync(string classCode, CancellationToken cancellationToken)
    {
        if (!await courses.TrySaveChangesAsync(cancellationToken))
        {
            throw ClassTaken(classCode);
        }
    }

    private static CourseSettings Normalize(CourseSettings settings)
    {
        var errors = new List<FieldError>();
        if (settings.MinGroupSize < 1)
        {
            errors.Add(new FieldError("minGroupSize", "A group needs at least 1 member."));
        }

        if (settings.MaxGroupSize < settings.MinGroupSize)
        {
            errors.Add(new FieldError("maxGroupSize", "The maximum group size cannot be below the minimum."));
        }

        if (settings.RoomFactor is < 1.00m or > MaxRoomFactor)
        {
            errors.Add(new FieldError("roomFactor", $"The room factor must be between 1.00 and {MaxRoomFactor}."));
        }

        var publishAt = Utc(settings.PublishAt);
        var expireAt = Utc(settings.ExpireAt);
        if (publishAt is not null && expireAt is not null && expireAt <= publishAt)
        {
            errors.Add(new FieldError("expireAt", "The deadline must come after the publish time."));
        }

        var lecturerName = string.IsNullOrWhiteSpace(settings.LecturerName) ? null : settings.LecturerName.Trim();
        if ((settings.LecturerId is null) != (lecturerName is null))
        {
            errors.Add(new FieldError("lecturerId", "Give both the lecturer's id and name, or neither."));
        }

        if (errors.Count > 0)
        {
            throw new ValidationFailedException(errors);
        }

        return settings with
        {
            ClassCode = settings.ClassCode.Trim().ToUpperInvariant(),
            LecturerName = lecturerName,
            RoomFactor = decimal.Round(settings.RoomFactor, 2),
            PublishAt = publishAt,
            ExpireAt = expireAt,
        };
    }

    private static DateTime? Utc(DateTime? value) => value switch
    {
        null => null,
        { Kind: DateTimeKind.Utc } utc => utc,
        { Kind: DateTimeKind.Local } local => local.ToUniversalTime(),
        { } unspecified => DateTime.SpecifyKind(unspecified, DateTimeKind.Utc),
    };

    private static void Apply(Course course, CourseSettings settings)
    {
        course.ClassCode = settings.ClassCode;
        course.LecturerId = settings.LecturerId;
        course.LecturerName = settings.LecturerName;
        course.MinGroupSize = settings.MinGroupSize;
        course.MaxGroupSize = settings.MaxGroupSize;
        course.RoomFactor = settings.RoomFactor;
        course.PublishAt = settings.PublishAt;
        course.ExpireAt = settings.ExpireAt;
    }

    private static ConflictException ClassTaken(string classCode) =>
        new(GroupErrorCodes.CourseClassTaken, $"Class '{classCode}' already has this subject in this semester.");

    private static CourseModel ToModel(CourseRow row) =>
        new(
            row.Course.CourseId,
            row.Course.SemesterId,
            row.SemesterCode,
            row.Course.SubjectId,
            row.SubjectCode,
            row.SubjectName,
            row.Course.ClassCode,
            row.Course.LecturerId,
            row.Course.LecturerName,
            row.Course.MinGroupSize,
            row.Course.MaxGroupSize,
            row.Course.RoomFactor,
            row.Course.Phase,
            row.Course.PublishAt,
            row.Course.ExpireAt,
            row.Course.FinalizedAt,
            row.StudentCount,
            row.RoomCount);
}
