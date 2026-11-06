using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.IntegrationTests;

public sealed class RoomsEndpointTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Course_members_see_rooms_with_members_majors_skills_and_eligibility()
    {
        var (se, ai, outsider) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(se, false), (ai, true)], rooms: 2, aiRequired: 1, minDistinctMajors: 2);
        var room = scenario.Rooms[0];
        await fixture.SeedAsync(
            database => database.StudentSkills.Add(new StudentSkill { SemesterId = scenario.SemesterId, StudentId = se, SkillId = database.Skill().SkillId, Level = 4 }),
            Ct);
        await RoomScenario.As(fixture, se).PostAsync($"/api/v1/rooms/{room}/join", null, Ct);
        var beforeAi = await DataAsync(await RoomScenario.As(fixture, se).GetAsync($"/api/v1/rooms/{room}", Ct));
        await RoomScenario.As(fixture, ai).PostAsync($"/api/v1/rooms/{room}/join", null, Ct);

        var detail = await DataAsync(await fixture.Api.ClientAs(Roles.Lecturer, scenario.LecturerId).GetAsync($"/api/v1/rooms/{room}", Ct));
        var withSeat = await DataAsync(await RoomScenario.As(fixture, se).GetAsync($"/api/v1/courses/{scenario.CourseId}/rooms?hasSeat=true&sort=-memberCount", Ct));
        var outsiderList = await fixture.Api.ClientAs(Roles.Student, outsider).GetAsync($"/api/v1/courses/{scenario.CourseId}/rooms", Ct);

        Assert.False(beforeAi.GetProperty("eligible").GetBoolean());
        Assert.True(detail.GetProperty("eligible").GetBoolean());
        Assert.Equal(2, detail.GetProperty("members").GetArrayLength());
        Assert.Equal(4, detail.GetProperty("members")[0].GetProperty("skills")[0].GetProperty("level").GetInt32());
        Assert.Contains(detail.GetProperty("majors").EnumerateArray(), major => major.GetProperty("required").GetInt32() == 1 && major.GetProperty("members").GetInt32() == 1);
        Assert.Equal(new[] { room, scenario.Rooms[1] }, withSeat.EnumerateArray().Select(item => item.GetProperty("id").GetGuid()));
        var card = withSeat.EnumerateArray().First();
        Assert.Equal(0, card.GetProperty("missingMajorSeats").GetInt32());
        Assert.Contains(card.GetProperty("majors").EnumerateArray(), major => major.GetProperty("required").GetInt32() == 1 && major.GetProperty("members").GetInt32() == 1);
        var empty = withSeat.EnumerateArray().Last();
        Assert.Equal(2, empty.GetProperty("missingMajorSeats").GetInt32());
        Assert.All(empty.GetProperty("majors").EnumerateArray(), major => Assert.Equal(0, major.GetProperty("members").GetInt32()));
        Assert.Equal(HttpStatusCode.Forbidden, outsiderList.StatusCode);
    }

    [Fact]
    public async Task Mine_lists_only_the_room_I_am_in()
    {
        var (member, waiting) = (Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(member, false), (waiting, false)], rooms: 3);
        await RoomScenario.As(fixture, member).PostAsync($"/api/v1/rooms/{scenario.Rooms[1]}/join", null, Ct);

        var mine = await DataAsync(await RoomScenario.As(fixture, member).GetAsync($"/api/v1/courses/{scenario.CourseId}/rooms?mine=true", Ct));
        var none = await DataAsync(await RoomScenario.As(fixture, waiting).GetAsync($"/api/v1/courses/{scenario.CourseId}/rooms?mine=true", Ct));
        var all = await DataAsync(await RoomScenario.As(fixture, waiting).GetAsync($"/api/v1/courses/{scenario.CourseId}/rooms", Ct));

        Assert.Equal(scenario.Rooms[1], Assert.Single(mine.EnumerateArray()).GetProperty("id").GetGuid());
        Assert.Empty(none.EnumerateArray());
        Assert.Equal(3, all.GetArrayLength());
    }

    [Fact]
    public async Task The_leader_sets_the_topic_and_administrators_rename_only_in_setup()
    {
        var (leader, member) = (Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false), (member, false)]);
        var room = scenario.Rooms[0];
        await RoomScenario.As(fixture, leader).PostAsync($"/api/v1/rooms/{room}/join", null, Ct);
        await RoomScenario.As(fixture, member).PostAsync($"/api/v1/rooms/{room}/join", null, Ct);

        var topic = await DataAsync(await RoomScenario.As(fixture, leader).PutAsJsonAsync($"/api/v1/rooms/{room}", new { topic = "Smart parking" }, Ct));
        var byMember = await RoomScenario.As(fixture, member).PutAsJsonAsync($"/api/v1/rooms/{room}", new { topic = "Other" }, Ct);
        var renameAfterPublish = await fixture.Api.ClientAs(Roles.Administrator).PutAsJsonAsync($"/api/v1/rooms/{room}", new { name = "Renamed" }, Ct);

        Assert.Equal("Smart parking", topic.GetProperty("topic").GetString());
        Assert.Equal("NOT_ROOM_LEADER", (await BodyAsync(byMember)).GetProperty("errors")[0].GetProperty("code").GetString());
        Assert.Equal("COURSE_NOT_IN_SETUP", (await BodyAsync(renameAfterPublish)).GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Fact]
    public async Task Administrators_rename_rooms_in_setup_with_unique_names()
    {
        var scenario = await RoomScenario.CreateAsync(fixture, [], rooms: 2, phase: CoursePhases.Setup);
        var admin = fixture.Api.ClientAs(Roles.Administrator);

        var renamed = await DataAsync(await admin.PutAsJsonAsync($"/api/v1/rooms/{scenario.Rooms[0]}", new { name = "Alpha" }, Ct));
        var duplicate = await admin.PutAsJsonAsync($"/api/v1/rooms/{scenario.Rooms[1]}", new { name = "Alpha" }, Ct);

        Assert.Equal("Alpha", renamed.GetProperty("name").GetString());
        Assert.Equal("ROOM_NAME_TAKEN", (await BodyAsync(duplicate)).GetProperty("errors")[0].GetProperty("code").GetString());
    }

    private static async Task<JsonElement> DataAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await BodyAsync(response)).GetProperty("data");
    }

    private static async Task<JsonElement> BodyAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement;
}
