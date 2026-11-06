using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Services.Events;
using ExeGroup.Group.Services.Rooms;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Group.IntegrationTests;

public sealed class CourseLifecycleTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private HttpClient Admin => fixture.Api.ClientAs(Roles.Administrator);

    [Theory]
    [InlineData(30, 6, 1.2, 6)]
    [InlineData(31, 6, 1.2, 7)]
    [InlineData(13, 5, 1.2, 4)]
    [InlineData(12, 4, 1.0, 3)]
    [InlineData(1, 6, 1.2, 1)]
    [InlineData(0, 6, 1.2, 0)]
    public void The_room_count_is_the_ceiling_of_students_over_size_times_factor(int students, int maxGroupSize, double roomFactor, int expected)
    {
        Assert.Equal(expected, RoomService.TargetRoomCount(students, maxGroupSize, (decimal)roomFactor));
    }

    [Fact]
    public async Task Generating_fills_the_course_up_to_the_formula_and_can_run_again()
    {
        var (course, groupType, otherType) = await SetupCourseAsync(students: 13, maxGroupSize: 5);

        var first = await DataAsync(await GenerateAsync(course.CourseId, groupType));
        var again = await DataAsync(await GenerateAsync(course.CourseId, groupType));
        await fixture.SeedAsync(
            database =>
            {
                foreach (var _ in Enumerable.Range(0, 7))
                {
                    database.Enroll(course, Guid.NewGuid());
                }
            },
            Ct);
        var grown = await DataAsync(await GenerateAsync(course.CourseId, groupType));
        var notAllowed = await GenerateAsync(course.CourseId, otherType);

        Assert.Equal((4, 4), (first.GetProperty("target").GetInt32(), first.GetProperty("created").GetInt32()));
        Assert.Equal(new[] { "Phòng 01", "Phòng 02", "Phòng 03", "Phòng 04" }, Names(first));
        Assert.All(first.GetProperty("rooms").EnumerateArray(), room =>
        {
            Assert.Equal(5, room.GetProperty("capacity").GetInt32());
            Assert.Equal(groupType, room.GetProperty("groupTypeId").GetGuid());
        });
        Assert.Equal((4, 0), (again.GetProperty("target").GetInt32(), again.GetProperty("created").GetInt32()));
        Assert.Equal((5, 1), (grown.GetProperty("target").GetInt32(), grown.GetProperty("created").GetInt32()));
        Assert.Equal("Phòng 05", Names(grown).Last());
        Assert.Equal(HttpStatusCode.BadRequest, notAllowed.StatusCode);
    }

    [Fact]
    public async Task Rooms_are_generated_and_deleted_only_in_setup()
    {
        var (course, groupType, _) = await SetupCourseAsync(students: 6, maxGroupSize: 6);
        var generated = await DataAsync(await GenerateAsync(course.CourseId, groupType));
        var first = generated.GetProperty("rooms")[0].GetProperty("id").GetGuid();
        var second = generated.GetProperty("rooms")[1].GetProperty("id").GetGuid();

        var deleted = await Admin.DeleteAsync($"/api/v1/rooms/{first}", Ct);
        var byStudent = await RoomScenario.As(fixture, Guid.NewGuid()).DeleteAsync($"/api/v1/rooms/{second}", Ct);
        await DataAsync(await Admin.PostAsync($"/api/v1/courses/{course.CourseId}/publish", null, Ct));
        var deleteAfterPublish = await Admin.DeleteAsync($"/api/v1/rooms/{second}", Ct);
        var generateAfterPublish = await GenerateAsync(course.CourseId, groupType);
        var left = await fixture.QueryAsync(database => database.Rooms.CountAsync(room => room.CourseId == course.CourseId, Ct));

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, byStudent.StatusCode);
        Assert.Equal("COURSE_NOT_IN_SETUP", await ErrorCodeAsync(deleteAfterPublish));
        Assert.Equal("COURSE_NOT_IN_SETUP", await ErrorCodeAsync(generateAfterPublish));
        Assert.Equal(1, left);
    }

    [Fact]
    public async Task Publishing_and_expiring_follow_the_phases_and_reject_pending_applications()
    {
        var (leader, applicant, bystander) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false), (applicant, false), (bystander, false)], phase: CoursePhases.Setup);
        var course = $"/api/v1/courses/{scenario.CourseId}";
        var room = scenario.Rooms[0];

        var expireInSetup = await Admin.PostAsync($"{course}/expire", null, Ct);
        var published = await DataAsync(await Admin.PostAsync($"{course}/publish", null, Ct));
        var publishTwice = await Admin.PostAsync($"{course}/publish", null, Ct);
        await RoomScenario.As(fixture, leader).PostAsync($"/api/v1/rooms/{room}/join", null, Ct);
        await RoomScenario.As(fixture, leader).PostAsync($"/api/v1/rooms/{room}/lock", null, Ct);
        var application = await RoomScenario.As(fixture, applicant).PostAsJsonAsync("/api/v1/join-requests", new { roomId = room }, Ct);
        var expired = await DataAsync(await Admin.PostAsync($"{course}/expire", null, Ct));
        var expireTwice = await Admin.PostAsync($"{course}/expire", null, Ct);
        var joinAfter = await RoomScenario.As(fixture, bystander).PostAsync($"/api/v1/rooms/{room}/join", null, Ct);

        Assert.Equal("COURSE_NOT_PUBLISHED", await ErrorCodeAsync(expireInSetup));
        Assert.Equal("Published", published.GetProperty("phase").GetString());
        Assert.Equal("COURSE_NOT_IN_SETUP", await ErrorCodeAsync(publishTwice));
        Assert.Equal(HttpStatusCode.Created, application.StatusCode);
        Assert.Equal("Expired", expired.GetProperty("phase").GetString());
        Assert.Equal("COURSE_NOT_PUBLISHED", await ErrorCodeAsync(expireTwice));
        Assert.Equal("COURSE_NOT_PUBLISHED", await ErrorCodeAsync(joinAfter));

        var request = await fixture.QueryAsync(database => database.JoinRequests.AsNoTracking().SingleAsync(item => item.RoomId == room, Ct));
        Assert.Equal((JoinRequestStatuses.Rejected, JoinRequestReasons.GroupingExpired), (request.Status, request.ReasonCode));
        var events = await fixture.QueryAsync(database => database.OutboxEvents.AsNoTracking()
            .Where(item => item.AggregateId == scenario.CourseId && item.EventType == GroupEventTypes.CoursePhaseChanged)
            .Select(item => item.Payload)
            .ToListAsync(Ct));
        var phases = events.Select(payload => JsonDocument.Parse(payload).RootElement).ToList();
        Assert.Equal(2, phases.Count);
        Assert.Contains(phases, payload => Property(payload, "phase").GetString() == "Published");
        var expiredEvent = Assert.Single(phases, payload => Property(payload, "phase").GetString() == "Expired");
        Assert.Equal(3, Property(expiredEvent, "studentIds").GetArrayLength());
        Assert.Equal(scenario.LecturerId, Property(expiredEvent, "lecturerId").GetGuid());
    }

    [Fact]
    public async Task A_course_whose_deadline_has_passed_cannot_be_published()
    {
        var scenario = await RoomScenario.CreateAsync(fixture, [(Guid.NewGuid(), false)], phase: CoursePhases.Setup);
        await fixture.SeedAsync(database => database.Courses.Single(course => course.CourseId == scenario.CourseId).ExpireAt = DateTime.UtcNow.AddMinutes(-1), Ct);

        var response = await Admin.PostAsync($"/api/v1/courses/{scenario.CourseId}/publish", null, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private async Task<(Course Course, Guid GroupType, Guid OtherType)> SetupCourseAsync(int students, int maxGroupSize)
    {
        Course course = null!;
        Guid groupType = Guid.Empty, otherType = Guid.Empty;
        await fixture.SeedAsync(
            database =>
            {
                var semester = database.Semester();
                course = database.Course(semester.SemesterId, database.Subject().SubjectId);
                course.MinGroupSize = 2;
                course.MaxGroupSize = maxGroupSize;
                groupType = database.GroupType(semester.SemesterId).GroupTypeId;
                otherType = database.GroupType().GroupTypeId;
                var major = database.Major();
                foreach (var _ in Enumerable.Range(0, students))
                {
                    database.Enroll(course, Guid.NewGuid(), major.MajorId);
                }
            },
            Ct);
        return (course, groupType, otherType);
    }

    private Task<HttpResponseMessage> GenerateAsync(Guid courseId, Guid groupTypeId) =>
        Admin.PostAsJsonAsync($"/api/v1/courses/{courseId}/rooms/generate", new { groupTypeId }, Ct);

    private static string?[] Names(JsonElement generation) =>
        generation.GetProperty("rooms").EnumerateArray().Select(room => room.GetProperty("name").GetString()).ToArray();

    private static JsonElement Property(JsonElement payload, string name) =>
        payload.EnumerateObject().First(property => string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase)).Value;

    private static async Task<JsonElement> DataAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.GetProperty("data");
    }

    private static async Task<string?> ErrorCodeAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.GetProperty("errors")[0].GetProperty("code").GetString();
    }
}
