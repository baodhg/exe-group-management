using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.IntegrationTests;

public sealed class RoomTopicAndCompositionTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task The_leader_topic_is_frozen_once_the_grouping_deadline_passes()
    {
        var leader = Guid.NewGuid();
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false)]);
        var client = RoomScenario.As(fixture, leader);
        var path = $"/api/v1/rooms/{scenario.Rooms[0]}";
        await client.PostAsync($"{path}/join", null, Ct);
        await fixture.Api.ClientAs(Roles.Administrator).PostAsync($"/api/v1/courses/{scenario.CourseId}/expire", null, Ct);

        var response = await client.PutAsJsonAsync(path, new { topic = "Too late" }, Ct);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("COURSE_NOT_PUBLISHED", (await BodyAsync(response)).GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Fact]
    public async Task An_administrator_can_still_fix_the_topic_after_the_grouping_deadline()
    {
        var leader = Guid.NewGuid();
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false)]);
        var client = RoomScenario.As(fixture, leader);
        var path = $"/api/v1/rooms/{scenario.Rooms[0]}";
        await client.PostAsync($"{path}/join", null, Ct);
        await fixture.Api.ClientAs(Roles.Administrator).PostAsync($"/api/v1/courses/{scenario.CourseId}/expire", null, Ct);

        var response = await fixture.Api.ClientAs(Roles.Administrator).PutAsJsonAsync(path, new { topic = "Fixed by the office" }, Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Fixed by the office", (await BodyAsync(response)).GetProperty("data").GetProperty("topic").GetString());
    }

    [Fact]
    public async Task A_duplicate_room_name_reports_the_name_conflict_only_for_a_rename()
    {
        var scenario = await RoomScenario.CreateAsync(fixture, [], rooms: 2, phase: CoursePhases.Setup);
        var admin = fixture.Api.ClientAs(Roles.Administrator);

        var renamed = await admin.PutAsJsonAsync($"/api/v1/rooms/{scenario.Rooms[0]}", new { name = "Alpha" }, Ct);
        var duplicate = await admin.PutAsJsonAsync($"/api/v1/rooms/{scenario.Rooms[1]}", new { name = "Alpha" }, Ct);

        Assert.Equal(HttpStatusCode.OK, renamed.StatusCode);
        Assert.Equal("ROOM_NAME_TAKEN", (await BodyAsync(duplicate)).GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Fact]
    public async Task The_room_detail_counts_the_seats_still_reserved_for_the_missing_majors()
    {
        var (se, ai) = (Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(se, false), (ai, true)], rooms: 1, aiRequired: 1, minDistinctMajors: 2);
        var room = scenario.Rooms[0];
        await RoomScenario.As(fixture, se).PostAsync($"/api/v1/rooms/{room}/join", null, Ct);

        var detail = await DataAsync(await fixture.Api.ClientAs(Roles.Lecturer, scenario.LecturerId).GetAsync($"/api/v1/rooms/{room}", Ct));

        Assert.Equal(1, detail.GetProperty("missingMajorSeats").GetInt32());
        Assert.False(detail.GetProperty("eligible").GetBoolean());
    }

    [Fact]
    public async Task A_complete_room_reports_no_reserved_seats()
    {
        var (se, ai) = (Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(se, false), (ai, true)], rooms: 1, aiRequired: 1, minDistinctMajors: 2);
        var room = scenario.Rooms[0];
        await RoomScenario.As(fixture, se).PostAsync($"/api/v1/rooms/{room}/join", null, Ct);
        await RoomScenario.As(fixture, ai).PostAsync($"/api/v1/rooms/{room}/join", null, Ct);

        var detail = await DataAsync(await fixture.Api.ClientAs(Roles.Lecturer, scenario.LecturerId).GetAsync($"/api/v1/rooms/{room}", Ct));

        Assert.Equal(0, detail.GetProperty("missingMajorSeats").GetInt32());
        Assert.True(detail.GetProperty("eligible").GetBoolean());
    }

    private static async Task<JsonElement> DataAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await BodyAsync(response)).GetProperty("data");
    }

    private static async Task<JsonElement> BodyAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement;
}
