using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Services.Events;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Group.IntegrationTests;

public sealed class OfficialTopicTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private HttpClient Admin => fixture.Api.ClientAs(Roles.Administrator);

    [Fact]
    public async Task The_lecturer_sets_the_topic_of_a_group_that_has_none()
    {
        var leader = Guid.NewGuid();
        var scenario = await FinalizedScenarioAsync(leader);
        var route = $"/api/v1/courses/{scenario.CourseId}/groups/{scenario.Rooms[0]}/topic";

        var set = await DataAsync(await Lecturer(scenario).PutAsJsonAsync(route, new { topic = "Ứng dụng quản lý lớp học" }, Ct));

        Assert.Equal("Ứng dụng quản lý lớp học", set.GetProperty("topic").GetString());
        Assert.False(set.GetProperty("topicMissing").GetBoolean());
        var topic = await fixture.QueryAsync(database => database.Rooms.AsNoTracking().Where(item => item.RoomId == scenario.Rooms[0]).Select(item => item.Topic).SingleAsync(Ct));
        Assert.Equal("Ứng dụng quản lý lớp học", topic);
        Assert.Contains(GroupEventTypes.TopicSet, await EventsAsync(scenario.Rooms[0]));
    }

    [Fact]
    public async Task A_group_that_already_has_a_topic_is_not_overwritten()
    {
        var leader = Guid.NewGuid();
        var scenario = await FinalizedScenarioAsync(leader);
        var route = $"/api/v1/courses/{scenario.CourseId}/groups/{scenario.Rooms[0]}/topic";
        await Lecturer(scenario).PutAsJsonAsync(route, new { topic = "Đề tài đầu" }, Ct);

        var again = await Lecturer(scenario).PutAsJsonAsync(route, new { topic = "Đề tài thứ hai" }, Ct);
        var byAdmin = await Admin.PutAsJsonAsync(route, new { topic = "Đề tài thứ ba" }, Ct);

        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Equal("TOPIC_ALREADY_SET", await ErrorCodeAsync(again));
        Assert.Equal("TOPIC_ALREADY_SET", await ErrorCodeAsync(byAdmin));
        var topic = await fixture.QueryAsync(database => database.Rooms.AsNoTracking().Where(item => item.RoomId == scenario.Rooms[0]).Select(item => item.Topic).SingleAsync(Ct));
        Assert.Equal("Đề tài đầu", topic);
    }

    [Fact]
    public async Task The_topic_can_be_cleared_and_set_again()
    {
        var leader = Guid.NewGuid();
        var scenario = await FinalizedScenarioAsync(leader);
        var route = $"/api/v1/courses/{scenario.CourseId}/groups/{scenario.Rooms[0]}/topic";
        await Lecturer(scenario).PutAsJsonAsync(route, new { topic = "Đề tài sai" }, Ct);

        var cleared = await DataAsync(await Lecturer(scenario).DeleteAsync(route, Ct));
        var again = await DataAsync(await Lecturer(scenario).PutAsJsonAsync(route, new { topic = "Đề tài đúng" }, Ct));

        Assert.True(cleared.GetProperty("topicMissing").GetBoolean());
        Assert.Equal("Đề tài đúng", again.GetProperty("topic").GetString());
    }

    [Fact]
    public async Task Only_the_lecturer_of_the_course_or_the_office_sets_the_topic()
    {
        var leader = Guid.NewGuid();
        var scenario = await FinalizedScenarioAsync(leader);
        var route = $"/api/v1/courses/{scenario.CourseId}/groups/{scenario.Rooms[0]}/topic";

        var otherLecturer = await fixture.Api.ClientAs(Roles.Lecturer).PutAsJsonAsync(route, new { topic = "Không được" }, Ct);
        var student = await RoomScenario.As(fixture, leader).PutAsJsonAsync(route, new { topic = "Không được" }, Ct);
        var byAdmin = await Admin.PutAsJsonAsync(route, new { topic = "Giáo vụ đặt" }, Ct);

        Assert.Equal(HttpStatusCode.Forbidden, otherLecturer.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, student.StatusCode);
        Assert.Equal(HttpStatusCode.OK, byAdmin.StatusCode);
    }

    [Fact]
    public async Task The_topic_cannot_be_set_before_the_course_is_finalized()
    {
        var leader = Guid.NewGuid();
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false)], phase: CoursePhases.Expired);
        var route = $"/api/v1/courses/{scenario.CourseId}/groups/{scenario.Rooms[0]}/topic";

        var response = await Lecturer(scenario).PutAsJsonAsync(route, new { topic = "Sớm quá" }, Ct);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("COURSE_NOT_FINALIZED", await ErrorCodeAsync(response));
    }

    [Fact]
    public async Task The_lecturer_asks_the_leader_to_add_a_topic()
    {
        var leader = Guid.NewGuid();
        var scenario = await FinalizedScenarioAsync(leader);
        var route = $"/api/v1/courses/{scenario.CourseId}/groups/{scenario.Rooms[0]}/topic-request";

        var asked = await DataAsync(await Lecturer(scenario).PostAsJsonAsync(route, new { note = "Nhóm mình cần đề tài" }, Ct));

        Assert.Equal(leader, asked.GetProperty("leaderId").GetGuid());
        Assert.Equal("Nhóm mình cần đề tài", asked.GetProperty("note").GetString());
        Assert.Contains(GroupEventTypes.TopicRequested, await EventsAsync(scenario.Rooms[0]));
    }

    [Fact]
    public async Task A_group_that_already_has_a_topic_is_not_asked_again()
    {
        var leader = Guid.NewGuid();
        var scenario = await FinalizedScenarioAsync(leader);
        var route = $"/api/v1/courses/{scenario.CourseId}/groups/{scenario.Rooms[0]}/topic-request";
        await Lecturer(scenario).PutAsJsonAsync($"/api/v1/courses/{scenario.CourseId}/groups/{scenario.Rooms[0]}/topic", new { topic = "Đã có" }, Ct);

        var response = await Lecturer(scenario).PostAsJsonAsync(route, new { }, Ct);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("TOPIC_ALREADY_SET", await ErrorCodeAsync(response));
    }

    [Fact]
    public async Task The_leader_of_a_finalized_group_adds_the_topic_after_being_asked()
    {
        var leader = Guid.NewGuid();
        var scenario = await FinalizedScenarioAsync(leader);
        await Lecturer(scenario).PostAsJsonAsync($"/api/v1/courses/{scenario.CourseId}/groups/{scenario.Rooms[0]}/topic-request", new { }, Ct);

        var set = await DataAsync(await RoomScenario.As(fixture, leader).PutAsJsonAsync($"/api/v1/courses/{scenario.CourseId}/groups/{scenario.Rooms[0]}/topic/by-leader", new { topic = "Đề tài của nhóm" }, Ct));

        Assert.Equal("Đề tài của nhóm", set.GetProperty("topic").GetString());
        var topic = await fixture.QueryAsync(database => database.Rooms.AsNoTracking().Where(item => item.RoomId == scenario.Rooms[0]).Select(item => item.Topic).SingleAsync(Ct));
        Assert.Equal("Đề tài của nhóm", topic);
    }

    [Fact]
    public async Task Only_the_leader_of_the_group_adds_the_topic_by_itself()
    {
        var (leader, member) = (Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false), (member, false)], capacity: 2, phase: CoursePhases.Expired);
        await SeatAsync(scenario.Rooms[0], leader, member);
        await fixture.SeedAsync(database =>
        {
            var course = database.Courses.Single(item => item.CourseId == scenario.CourseId);
            course.Phase = CoursePhases.Finalized;
            course.FinalizedAt = DateTime.UtcNow;
        }, Ct);
        var route = $"/api/v1/courses/{scenario.CourseId}/groups/{scenario.Rooms[0]}/topic/by-leader";

        var byMember = await RoomScenario.As(fixture, member).PutAsJsonAsync(route, new { topic = "Của thành viên" }, Ct);
        var byLeader = await RoomScenario.As(fixture, leader).PutAsJsonAsync(route, new { topic = "Của trưởng nhóm" }, Ct);

        Assert.Equal(HttpStatusCode.Forbidden, byMember.StatusCode);
        Assert.Equal("NOT_ROOM_LEADER", await ErrorCodeAsync(byMember));
        Assert.Equal(HttpStatusCode.OK, byLeader.StatusCode);
    }

    [Fact]
    public async Task The_groups_without_a_topic_are_listed()
    {
        var (leader, member) = (Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false), (member, false)], capacity: 2, rooms: 2, phase: CoursePhases.Expired);
        await SeatAsync(scenario.Rooms[0], leader);
        await SeatAsync(scenario.Rooms[1], member);
        await fixture.SeedAsync(database =>
        {
            var course = database.Courses.Single(item => item.CourseId == scenario.CourseId);
            course.Phase = CoursePhases.Finalized;
            course.FinalizedAt = DateTime.UtcNow;
        }, Ct);
        await Lecturer(scenario).PutAsJsonAsync($"/api/v1/courses/{scenario.CourseId}/groups/{scenario.Rooms[0]}/topic", new { topic = "Có rồi" }, Ct);

        var missing = await DataAsync(await Lecturer(scenario).GetAsync($"/api/v1/courses/{scenario.CourseId}/groups/missing-topics", Ct));
        var all = await DataAsync(await Lecturer(scenario).GetAsync($"/api/v1/courses/{scenario.CourseId}/groups", Ct));

        Assert.Single(missing.GetProperty("groups").EnumerateArray());
        var room = missing.GetProperty("groups").EnumerateArray().Single();
        Assert.Equal(scenario.Rooms[1], room.GetProperty("roomId").GetGuid());
        Assert.Equal(2, all.GetProperty("groups").GetArrayLength());
        var first = all.GetProperty("groups").EnumerateArray().Single(group => group.GetProperty("roomId").GetGuid() == scenario.Rooms[0]);
        Assert.False(first.GetProperty("topicMissing").GetBoolean());
        var second = all.GetProperty("groups").EnumerateArray().Single(group => group.GetProperty("roomId").GetGuid() == scenario.Rooms[1]);
        Assert.True(second.GetProperty("topicMissing").GetBoolean());
    }

    private async Task<RoomScenario> FinalizedScenarioAsync(Guid leader)
    {
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false)], phase: CoursePhases.Expired);
        await SeatAsync(scenario.Rooms[0], leader);
        await fixture.SeedAsync(database =>
        {
            var course = database.Courses.Single(item => item.CourseId == scenario.CourseId);
            course.Phase = CoursePhases.Finalized;
            course.FinalizedAt = DateTime.UtcNow;
        }, Ct);
        return scenario;
    }

    private HttpClient Lecturer(RoomScenario scenario) => fixture.Api.ClientAs(Roles.Lecturer, scenario.LecturerId);

    private Task SeatAsync(Guid roomId, params Guid[] students) =>
        fixture.SeedAsync(
            database =>
            {
                var room = database.Rooms.Single(item => item.RoomId == roomId);
                foreach (var studentId in students)
                {
                    database.Join(room, studentId);
                }
            },
            Ct);

    private Task<List<string>> EventsAsync(params Guid[] aggregateIds) =>
        fixture.QueryAsync(database => database.OutboxEvents.AsNoTracking()
            .Where(item => aggregateIds.Contains(item.AggregateId))
            .Select(item => item.EventType)
            .ToListAsync(Ct));

    private static async Task<JsonElement> DataAsync(HttpResponseMessage response, HttpStatusCode expected = HttpStatusCode.OK)
    {
        Assert.Equal(expected, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.GetProperty("data");
    }

    private static async Task<string?> ErrorCodeAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.GetProperty("errors")[0].GetProperty("code").GetString();
}
