using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.IntegrationTests;

public sealed class RostersEndpointTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private HttpClient Admin => fixture.Api.ClientAs(Roles.Administrator);

    [Fact]
    public async Task Semester_students_are_added_or_updated_without_duplicates()
    {
        Guid semesterId = Guid.Empty, se = Guid.Empty, ai = Guid.Empty;
        await fixture.SeedAsync(database => (semesterId, se, ai) = (database.Semester().SemesterId, database.Major().MajorId, database.Major().MajorId), Ct);
        var (first, second, third) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var route = $"/api/v1/semesters/{semesterId}/students";

        var added = await ReadAsync(await Admin.PostAsJsonAsync(route, new { students = new[] { Student(first, "se001", "An", se), Student(second, "SE002", "Binh", se) } }, Ct));
        var again = await ReadAsync(await Admin.PostAsJsonAsync(route, new { students = new[] { Student(first, "SE001", "An Nguyen", se), Student(third, "SE003", "Chi", ai) } }, Ct));
        var list = await ReadAsync(await Admin.GetAsync($"{route}?majorId={se}&sort=studentCode", Ct));

        Assert.Equal((2, 0), (added.Data().GetProperty("added").GetInt32(), added.Data().GetProperty("updated").GetInt32()));
        Assert.Equal((1, 1), (again.Data().GetProperty("added").GetInt32(), again.Data().GetProperty("updated").GetInt32()));
        Assert.Equal(new[] { "An Nguyen", "Binh" }, list.Data().EnumerateArray().Select(item => item.GetProperty("fullName").GetString()));
        Assert.Equal("SE001", list.Data()[0].GetProperty("studentCode").GetString());
    }

    [Fact]
    public async Task An_unknown_major_is_rejected_and_a_student_in_a_room_keeps_their_major()
    {
        var studentId = Guid.NewGuid();
        Guid semesterId = Guid.Empty, otherMajor = Guid.Empty;
        await fixture.SeedAsync(
            database =>
            {
                var (course, room) = CourseWithRoom(database);
                database.Enroll(course, studentId);
                database.Join(room, studentId);
                (semesterId, otherMajor) = (course.SemesterId, database.Major().MajorId);
            },
            Ct);
        var route = $"/api/v1/semesters/{semesterId}/students";

        var unknown = await Admin.PostAsJsonAsync(route, new { students = new[] { Student(Guid.NewGuid(), "SE900", "X", Guid.NewGuid()) } }, Ct);
        var moved = await Admin.PostAsJsonAsync(route, new { students = new[] { Student(studentId, "SE901", "Y", otherMajor) } }, Ct);

        Assert.Equal("majorId", await ErrorAsync(unknown, "field"));
        Assert.Equal("STUDENT_MAJOR_LOCKED", await ErrorAsync(moved, "code"));
    }

    [Fact]
    public async Task Enrolling_again_skips_and_students_of_another_semester_are_refused()
    {
        var (first, second, stranger) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        Guid courseId = Guid.Empty;
        await fixture.SeedAsync(
            database =>
            {
                var semester = database.Semester();
                var major = database.Major();
                var course = database.Course(semester.SemesterId, database.Subject().SubjectId);
                database.Student(semester.SemesterId, major.MajorId, first);
                database.Student(semester.SemesterId, major.MajorId, second);
                database.Student(database.Semester().SemesterId, major.MajorId, stranger);
                courseId = course.CourseId;
            },
            Ct);
        var route = $"/api/v1/courses/{courseId}/students";

        var enrolled = await ReadAsync(await Admin.PostAsJsonAsync(route, new { studentIds = new[] { first, second } }, Ct));
        var repeated = await ReadAsync(await Admin.PostAsJsonAsync(route, new { studentIds = new[] { first, second } }, Ct));
        var outside = await Admin.PostAsJsonAsync(route, new { studentIds = new[] { stranger } }, Ct);

        Assert.Equal(2, enrolled.Data().GetProperty("enrolled").GetInt32());
        Assert.Equal((0, 2), (repeated.Data().GetProperty("enrolled").GetInt32(), repeated.Data().GetProperty("alreadyEnrolled").GetInt32()));
        Assert.Equal(HttpStatusCode.Conflict, outside.StatusCode);
        Assert.Equal("STUDENT_NOT_IN_SEMESTER", await ErrorAsync(outside, "code"));
    }

    [Fact]
    public async Task The_roster_filters_by_room_for_its_lecturer_and_administrators_only()
    {
        var (lecturerId, inRoom, withoutRoom) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        Guid courseId = Guid.Empty;
        string roomName = string.Empty;
        await fixture.SeedAsync(
            database =>
            {
                var (course, room) = CourseWithRoom(database);
                course.LecturerId = lecturerId;
                course.LecturerName = "Dr. Lan";
                database.Enroll(course, inRoom);
                database.Enroll(course, withoutRoom);
                database.Join(room, inRoom);
                (courseId, roomName) = (course.CourseId, room.Name);
            },
            Ct);
        var route = $"/api/v1/courses/{courseId}/students";

        var withRoom = await ReadAsync(await Admin.GetAsync($"{route}?hasRoom=true", Ct));
        var noRoom = await ReadAsync(await fixture.Api.ClientAs(Roles.Lecturer, lecturerId).GetAsync($"{route}?hasRoom=false", Ct));
        var otherLecturer = await fixture.Api.ClientAs(Roles.Lecturer).GetAsync(route, Ct);
        var student = await fixture.Api.ClientAs(Roles.Student, inRoom).GetAsync(route, Ct);

        var entry = Assert.Single(withRoom.Data().EnumerateArray());
        Assert.Equal(inRoom, entry.GetProperty("studentId").GetGuid());
        Assert.Equal(roomName, entry.GetProperty("roomName").GetString());
        Assert.Equal(withoutRoom, Assert.Single(noRoom.Data().EnumerateArray()).GetProperty("studentId").GetGuid());
        Assert.Equal(HttpStatusCode.Forbidden, otherLecturer.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, student.StatusCode);
    }

    [Fact]
    public async Task Students_leave_the_roster_and_the_semester_only_when_nothing_holds_them()
    {
        var (inRoom, withoutRoom, notEnrolled) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        Guid courseId = Guid.Empty, semesterId = Guid.Empty;
        await fixture.SeedAsync(
            database =>
            {
                var (course, room) = CourseWithRoom(database);
                database.Enroll(course, inRoom);
                database.Enroll(course, withoutRoom);
                database.Join(room, inRoom);
                database.Student(course.SemesterId, database.Major().MajorId, notEnrolled);
                (courseId, semesterId) = (course.CourseId, course.SemesterId);
            },
            Ct);

        var keepInRoom = await Admin.DeleteAsync($"/api/v1/courses/{courseId}/students/{inRoom}", Ct);
        var removeEnrolled = await Admin.DeleteAsync($"/api/v1/courses/{courseId}/students/{withoutRoom}", Ct);
        var semesterEnrolled = await Admin.DeleteAsync($"/api/v1/semesters/{semesterId}/students/{inRoom}", Ct);
        var semesterFree = await Admin.DeleteAsync($"/api/v1/semesters/{semesterId}/students/{notEnrolled}", Ct);

        Assert.Equal("STUDENT_IN_ROOM", await ErrorAsync(keepInRoom, "code"));
        Assert.Equal(HttpStatusCode.NoContent, removeEnrolled.StatusCode);
        Assert.Equal("STUDENT_ENROLLED", await ErrorAsync(semesterEnrolled, "code"));
        Assert.Equal(HttpStatusCode.NoContent, semesterFree.StatusCode);
    }

    private static (Course Course, Room Room) CourseWithRoom(Repositories.Data.GroupDbContext database)
    {
        var semester = database.Semester();
        var course = database.Course(semester.SemesterId, database.Subject().SubjectId);
        var groupType = database.GroupType(semester.SemesterId);
        return (course, database.Room(course, groupType.GroupTypeId));
    }

    private static object Student(Guid studentId, string studentCode, string fullName, Guid majorId) =>
        new { studentId, studentCode, fullName, email = $"{studentId:N}@fpt.edu.vn", majorId };

    private static async Task<string?> ErrorAsync(HttpResponseMessage response, string property) =>
        (await ReadAsync(response)).GetProperty("errors")[0].GetProperty(property).GetString();

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement;
}
