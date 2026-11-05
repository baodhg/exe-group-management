using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.IntegrationTests;

public sealed class CoursesEndpointTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private const string Route = "/api/v1/courses";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private HttpClient Admin => fixture.Api.ClientAs(Roles.Administrator);

    [Fact]
    public async Task An_administrator_creates_updates_and_deletes_a_course()
    {
        var (semesterId, subjectId) = await SemesterAndSubjectAsync();
        var lecturerId = Guid.NewGuid();

        var created = await Admin.PostAsJsonAsync(Route, NewCourse(semesterId, subjectId, "se1801"), Ct);
        var body = await ReadAsync(created);
        var id = body.Data().GetProperty("id").GetGuid();
        var updated = await ReadAsync(await Admin.PutAsJsonAsync($"{Route}/{id}", Settings("SE1801", lecturerId, "Dr. Lan", minGroupSize: 3, maxGroupSize: 5), Ct));
        var deleted = await Admin.DeleteAsync($"{Route}/{id}", Ct);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.NotNull(created.Headers.Location);
        Assert.Equal("SE1801", body.Data().GetProperty("classCode").GetString());
        Assert.Equal("Setup", body.Data().GetProperty("phase").GetString());
        Assert.Equal(lecturerId, updated.Data().GetProperty("lecturerId").GetGuid());
        Assert.Equal(3, updated.Data().GetProperty("minGroupSize").GetInt32());
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
    }

    [Fact]
    public async Task A_class_takes_a_subject_once_per_semester()
    {
        var (semesterId, subjectId) = await SemesterAndSubjectAsync();
        var (_, otherSubjectId) = await SemesterAndSubjectAsync();
        await Admin.PostAsJsonAsync(Route, NewCourse(semesterId, subjectId, "SE1802"), Ct);

        var duplicate = await Admin.PostAsJsonAsync(Route, NewCourse(semesterId, subjectId, "se1802"), Ct);
        var otherSubject = await Admin.PostAsJsonAsync(Route, NewCourse(semesterId, otherSubjectId, "SE1802"), Ct);

        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.Equal("COURSE_CLASS_TAKEN", await ErrorAsync(duplicate, "code"));
        Assert.Equal(HttpStatusCode.Created, otherSubject.StatusCode);
    }

    [Theory]
    [InlineData(0, 6, 1.2, 0, "minGroupSize")]
    [InlineData(5, 4, 1.2, 0, "maxGroupSize")]
    [InlineData(4, 6, 0.9, 0, "roomFactor")]
    [InlineData(4, 6, 1.2, -1, "expireAt")]
    public async Task Group_sizes_room_factor_and_schedule_are_checked_before_saving(int min, int max, double factor, int expireOffsetDays, string field)
    {
        var (semesterId, subjectId) = await SemesterAndSubjectAsync();
        var publishAt = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);
        var request = new
        {
            semesterId,
            subjectId,
            classCode = GroupSeed.Code("SE"),
            minGroupSize = min,
            maxGroupSize = max,
            roomFactor = factor,
            publishAt,
            expireAt = expireOffsetDays == 0 ? (DateTime?)null : publishAt.AddDays(expireOffsetDays),
        };

        var response = await Admin.PostAsJsonAsync(Route, request, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(field, await ErrorAsync(response, "field"));
    }

    [Fact]
    public async Task A_lecturer_sees_only_the_courses_they_teach()
    {
        var lecturerId = Guid.NewGuid();
        Course taught = null!, other = null!;
        await fixture.SeedAsync(
            database =>
            {
                var semester = database.Semester();
                taught = database.Course(semester.SemesterId, database.Subject().SubjectId);
                taught.LecturerId = lecturerId;
                taught.LecturerName = "Dr. Minh";
                other = database.Course(semester.SemesterId, database.Subject().SubjectId);
            },
            Ct);
        var lecturer = fixture.Api.ClientAs(Roles.Lecturer, lecturerId);

        var mine = await ReadAsync(await lecturer.GetAsync($"{Route}?mine=true&semesterId={taught.SemesterId}", Ct));
        var ownCourse = await lecturer.GetAsync($"{Route}/{taught.CourseId}", Ct);
        var otherCourse = await lecturer.GetAsync($"{Route}/{other.CourseId}", Ct);

        Assert.Equal(taught.CourseId, Assert.Single(mine.Data().EnumerateArray()).GetProperty("id").GetGuid());
        Assert.Equal(HttpStatusCode.OK, ownCourse.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, otherCourse.StatusCode);
    }

    [Fact]
    public async Task A_student_opens_only_the_courses_they_are_enrolled_in()
    {
        var studentId = Guid.NewGuid();
        Course enrolled = null!, other = null!;
        await fixture.SeedAsync(
            database =>
            {
                var semester = database.Semester();
                enrolled = database.Course(semester.SemesterId, database.Subject().SubjectId);
                other = database.Course(semester.SemesterId, database.Subject().SubjectId);
                database.Enroll(enrolled, studentId);
            },
            Ct);
        var student = fixture.Api.ClientAs(Roles.Student, studentId);

        var mine = await ReadAsync(await student.GetAsync($"{Route}?mine=true", Ct));
        var enrolledCourse = await ReadAsync(await student.GetAsync($"{Route}/{enrolled.CourseId}", Ct));
        var otherCourse = await student.GetAsync($"{Route}/{other.CourseId}", Ct);

        Assert.Equal(enrolled.CourseId, Assert.Single(mine.Data().EnumerateArray()).GetProperty("id").GetGuid());
        Assert.Equal(1, enrolledCourse.Data().GetProperty("studentCount").GetInt32());
        Assert.Equal(HttpStatusCode.Forbidden, otherCourse.StatusCode);
    }

    [Fact]
    public async Task After_publishing_only_the_lecturer_and_a_later_deadline_can_change()
    {
        var expireAt = DateTime.UtcNow.AddDays(3);
        Course course = null!;
        await fixture.SeedAsync(
            database =>
            {
                var semester = database.Semester();
                course = database.Course(semester.SemesterId, database.Subject().SubjectId);
                course.Phase = CoursePhases.Published;
                course.ExpireAt = expireAt;
            },
            Ct);
        var route = $"{Route}/{course.CourseId}";

        var resized = await Admin.PutAsJsonAsync(route, Settings(course.ClassCode, minGroupSize: 2, expireAt: expireAt), Ct);
        var earlier = await Admin.PutAsJsonAsync(route, Settings(course.ClassCode, expireAt: expireAt.AddDays(-1)), Ct);
        var later = await Admin.PutAsJsonAsync(route, Settings(course.ClassCode, Guid.NewGuid(), "Dr. Hoa", expireAt: expireAt.AddDays(2)), Ct);
        var deleted = await Admin.DeleteAsync(route, Ct);

        Assert.Equal("COURSE_NOT_IN_SETUP", await ErrorAsync(resized, "code"));
        Assert.Equal("COURSE_SCHEDULE_LOCKED", await ErrorAsync(earlier, "code"));
        Assert.Equal(HttpStatusCode.OK, later.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, deleted.StatusCode);
    }

    [Fact]
    public async Task An_unknown_subject_is_rejected()
    {
        var (semesterId, _) = await SemesterAndSubjectAsync();

        var response = await Admin.PostAsJsonAsync(Route, NewCourse(semesterId, Guid.NewGuid(), "SE1803"), Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("subjectId", await ErrorAsync(response, "field"));
    }

    private async Task<(Guid SemesterId, Guid SubjectId)> SemesterAndSubjectAsync()
    {
        Guid semesterId = Guid.Empty, subjectId = Guid.Empty;
        await fixture.SeedAsync(database => (semesterId, subjectId) = (database.Semester().SemesterId, database.Subject().SubjectId), Ct);
        return (semesterId, subjectId);
    }

    private static object NewCourse(Guid semesterId, Guid subjectId, string classCode) =>
        new { semesterId, subjectId, classCode, minGroupSize = 4, maxGroupSize = 6, roomFactor = 1.2m };

    private static object Settings(
        string classCode,
        Guid? lecturerId = null,
        string? lecturerName = null,
        int minGroupSize = 4,
        int maxGroupSize = 6,
        DateTime? expireAt = null) =>
        new { classCode, lecturerId, lecturerName, minGroupSize, maxGroupSize, roomFactor = 1.2m, expireAt };

    private static async Task<string?> ErrorAsync(HttpResponseMessage response, string property) =>
        (await ReadAsync(response)).GetProperty("errors")[0].GetProperty(property).GetString();

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement;
}
