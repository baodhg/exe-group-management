using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Reflection;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Group.API.Models.Courses;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.IntegrationTests;

public sealed class GroupingRegressionTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;
    private HttpClient Admin => fixture.Api.ClientAs(Roles.Administrator);

    [Fact]
    public async Task Publishing_requires_rooms_and_enough_seats_and_can_be_retried_after_generation()
    {
        var scenario = await RoomScenario.CreateAsync(fixture, [(Guid.NewGuid(), false)], rooms: 0, phase: CoursePhases.Setup);
        var typeId = Guid.Empty;
        await fixture.SeedAsync(db => typeId = db.GroupType(scenario.SemesterId).GroupTypeId, Ct);
        var path = $"/api/v1/courses/{scenario.CourseId}";
        Assert.Equal("COURSE_NOT_READY", await CodeAsync(await Admin.PostAsync($"{path}/publish", null, Ct)));
        Assert.Equal(HttpStatusCode.OK, (await Admin.PostAsJsonAsync($"{path}/rooms/generate", new { groupTypeId = typeId }, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Admin.PostAsync($"{path}/publish", null, Ct)).StatusCode);

        var tooSmall = await RoomScenario.CreateAsync(fixture, Enumerable.Range(0, 4).Select(_ => (Guid.NewGuid(), false)).ToList(), capacity: 3, phase: CoursePhases.Setup);
        Assert.Equal("COURSE_NOT_READY", await CodeAsync(await Admin.PostAsync($"/api/v1/courses/{tooSmall.CourseId}/publish", null, Ct)));
    }

    [Fact]
    public async Task Maximum_size_cannot_drift_from_existing_rooms()
    {
        var scenario = await RoomScenario.CreateAsync(fixture, [(Guid.NewGuid(), false)], phase: CoursePhases.Setup);
        var path = $"/api/v1/courses/{scenario.CourseId}";
        var settings = new { classCode = "SIZE", lecturerId = scenario.LecturerId, lecturerName = "Dr. Lan", minGroupSize = 2, maxGroupSize = 2, roomFactor = 1.2 };
        Assert.Equal("COURSE_SIZE_LOCKED", await CodeAsync(await Admin.PutAsJsonAsync(path, settings, Ct)));
        await Admin.DeleteAsync($"/api/v1/rooms/{scenario.Rooms[0]}", Ct);
        Assert.Equal(HttpStatusCode.OK, (await Admin.PutAsJsonAsync(path, settings, Ct)).StatusCode);
    }

    [Fact]
    public async Task Legacy_oversized_rooms_cannot_accept_more_members_or_finalize_above_the_course_maximum()
    {
        var ids = Enumerable.Range(0, 5).Select(_ => Guid.NewGuid()).ToArray();
        var scenario = await RoomScenario.CreateAsync(fixture, ids.Select(id => (id, false)).ToList(), capacity: 6);
        var path = $"/api/v1/rooms/{scenario.Rooms[0]}";
        foreach (var id in ids.Take(4))
        {
            await RoomScenario.As(fixture, id).PostAsync($"{path}/join", null, Ct);
        }
        await fixture.SeedAsync(db => db.Courses.Single(course => course.CourseId == scenario.CourseId).MaxGroupSize = 4, Ct);
        Assert.Equal("ROOM_FULL", await CodeAsync(await RoomScenario.As(fixture, ids[4]).PostAsync($"{path}/join", null, Ct)));
        await fixture.SeedAsync(db => db.Join(db.Rooms.Single(room => room.RoomId == scenario.Rooms[0]), ids[4]), Ct);
        await Admin.PostAsync($"/api/v1/courses/{scenario.CourseId}/expire", null, Ct);
        Assert.Equal("FINALIZE_BLOCKED", await CodeAsync(await Admin.PostAsJsonAsync($"/api/v1/courses/{scenario.CourseId}/finalize", new { acceptExceptions = true }, Ct)));
    }

    [Fact]
    public async Task Impossible_rules_are_rejected_when_generating_retyping_and_publishing()
    {
        var scenario = await RoomScenario.CreateAsync(fixture, [(Guid.NewGuid(), false)], capacity: 2, phase: CoursePhases.Setup);
        var impossibleType = Guid.Empty;
        await fixture.SeedAsync(db =>
        {
            var type = db.GroupType(scenario.SemesterId);
            type.MinDistinctMajors = 3;
            impossibleType = type.GroupTypeId;
        }, Ct);
        var generated = await Admin.PostAsJsonAsync($"/api/v1/courses/{scenario.CourseId}/rooms/generate", new { groupTypeId = impossibleType }, Ct);
        var retyped = await Admin.PutAsJsonAsync($"/api/v1/rooms/{scenario.Rooms[0]}", new { groupTypeId = impossibleType }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, generated.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, retyped.StatusCode);
        await fixture.SeedAsync(db => db.Rooms.Single(room => room.RoomId == scenario.Rooms[0]).GroupTypeId = impossibleType, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, (await Admin.PostAsync($"/api/v1/courses/{scenario.CourseId}/publish", null, Ct)).StatusCode);
    }

    [Fact]
    public async Task Used_rules_cannot_change_even_after_finalize_but_names_and_identical_rules_can_be_saved()
    {
        var (first, second) = (Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(first, false), (second, false)]);
        var roomPath = $"/api/v1/rooms/{scenario.Rooms[0]}";
        await RoomScenario.As(fixture, first).PostAsync($"{roomPath}/join", null, Ct);
        await RoomScenario.As(fixture, second).PostAsync($"{roomPath}/join", null, Ct);
        await Admin.PostAsync($"/api/v1/courses/{scenario.CourseId}/expire", null, Ct);
        Assert.Equal(HttpStatusCode.OK, (await Admin.PostAsJsonAsync($"/api/v1/courses/{scenario.CourseId}/finalize", new { acceptExceptions = false }, Ct)).StatusCode);
        var room = await DataAsync(await Admin.GetAsync(roomPath, Ct));
        var typePath = $"/api/v1/group-types/{room.GetProperty("groupTypeId").GetGuid()}";
        var type = await DataAsync(await Admin.GetAsync(typePath, Ct));
        var changed = await Admin.PutAsJsonAsync(typePath, new { code = type.GetProperty("code").GetString(), name = "Renamed", minDistinctMajors = 3 }, Ct);
        var minimums = await Admin.PutAsJsonAsync($"{typePath}/majors", new[] { new { majorId = scenario.Se, minMembers = 2 } }, Ct);
        Assert.Equal("GROUP_TYPE_IN_USE", await CodeAsync(changed));
        Assert.Equal("GROUP_TYPE_IN_USE", await CodeAsync(minimums));
        Assert.Equal(HttpStatusCode.OK, (await Admin.PutAsJsonAsync(typePath, new { code = type.GetProperty("code").GetString(), name = "Renamed", minDistinctMajors = 1 }, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Admin.PutAsJsonAsync($"{typePath}/majors", Array.Empty<object>(), Ct)).StatusCode);
        Assert.True((await DataAsync(await Admin.GetAsync(roomPath, Ct))).GetProperty("eligible").GetBoolean());
    }

    [Fact]
    public async Task Deadline_guards_apply_before_the_scheduler_updates_the_phase()
    {
        var (leader, applicant, waiting) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false), (applicant, false), (waiting, false)], rooms: 2);
        var student = RoomScenario.As(fixture, leader);
        var room = $"/api/v1/rooms/{scenario.Rooms[0]}";
        await student.PostAsync($"{room}/join", null, Ct);
        await student.PostAsync($"{room}/lock", null, Ct);
        var application = await DataAsync(await RoomScenario.As(fixture, applicant).PostAsJsonAsync("/api/v1/join-requests", new { roomId = scenario.Rooms[0] }, Ct));
        await fixture.SeedAsync(db => db.Courses.Single(course => course.CourseId == scenario.CourseId).ExpireAt = DateTime.UtcNow.AddMinutes(-1), Ct);

        Assert.Equal("COURSE_NOT_PUBLISHED", await CodeAsync(await RoomScenario.As(fixture, waiting).PostAsync($"/api/v1/rooms/{scenario.Rooms[1]}/join", null, Ct)));
        Assert.Equal("COURSE_NOT_PUBLISHED", await CodeAsync(await student.PostAsync($"{room}/leave", null, Ct)));
        Assert.Equal("COURSE_NOT_PUBLISHED", await CodeAsync(await student.PostAsync($"{room}/unlock", null, Ct)));
        Assert.Equal("COURSE_NOT_PUBLISHED", await CodeAsync(await student.PutAsJsonAsync(room, new { topic = "Too late" }, Ct)));
        Assert.Equal("COURSE_NOT_PUBLISHED", await CodeAsync(await student.PostAsync($"/api/v1/join-requests/{application.GetProperty("id").GetGuid()}/approve", null, Ct)));
        Assert.Equal("COURSE_NOT_PUBLISHED", await CodeAsync(await RoomScenario.As(fixture, applicant).PostAsync($"/api/v1/join-requests/{application.GetProperty("id").GetGuid()}/withdraw", null, Ct)));
        Assert.Equal("SKILLS_LOCKED", await CodeAsync(await student.PutAsJsonAsync($"/api/v1/semesters/{scenario.SemesterId}/students/me/skills", Array.Empty<object>(), Ct)));
    }

    [Fact]
    public async Task Expired_room_topic_is_frozen_for_the_leader()
    {
        var leader = Guid.NewGuid();
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false)]);
        var client = RoomScenario.As(fixture, leader);
        var path = $"/api/v1/rooms/{scenario.Rooms[0]}";
        await client.PostAsync($"{path}/join", null, Ct);
        await Admin.PostAsync($"/api/v1/courses/{scenario.CourseId}/expire", null, Ct);
        Assert.Equal("COURSE_NOT_PUBLISHED", await CodeAsync(await client.PutAsJsonAsync(path, new { topic = "Too late" }, Ct)));
    }

    [Theory]
    [InlineData("vi-VN")]
    [InlineData("en-US")]
    public void Room_factor_validation_is_independent_of_current_culture(string culture)
    {
        var previous = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = new CultureInfo(culture);
            var attribute = typeof(CourseSettingsRequest).GetProperty(nameof(CourseSettingsRequest.RoomFactor))!.GetCustomAttribute<RangeAttribute>()!;
            Assert.True(attribute.IsValid(1.2m));
            Assert.False(attribute.IsValid(0.9m));
            Assert.False(attribute.IsValid(10m));
        }
        finally { CultureInfo.CurrentCulture = previous; }
    }

    private static async Task<JsonElement> DataAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.GetProperty("data");
    private static async Task<string?> CodeAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.GetProperty("errors")[0].GetProperty("code").GetString();
    }
}
