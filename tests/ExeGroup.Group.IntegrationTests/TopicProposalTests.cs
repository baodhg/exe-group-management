using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Services.Events;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Group.IntegrationTests;

public sealed class TopicProposalTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task The_leader_proposes_a_topic_and_the_lecturer_approves_it()
    {
        var leader = Guid.NewGuid();
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false)]);
        var room = scenario.Rooms[0];
        await JoinAsync(leader, room);

        var created = await DataAsync(await ProposeAsync(leader, room, "Ứng dụng quản lý lớp học", "Nhóm muốn làm sản phẩm cho trường"), HttpStatusCode.Created);        var proposalId = created.GetProperty("id").GetGuid();
        var approved = await DataAsync(await ReviewAsync(scenario.LecturerId, proposalId, "Approved", "Hợp lý"));
        var topic = await fixture.QueryAsync(database => database.Rooms.AsNoTracking().Where(item => item.RoomId == room).Select(item => item.Topic).SingleAsync(Ct));

        Assert.Equal("Pending", created.GetProperty("status").GetString());
        Assert.Equal(1, created.GetProperty("round").GetInt32());
        Assert.Equal("Approved", approved.GetProperty("status").GetString());
        Assert.Equal(scenario.LecturerId, approved.GetProperty("reviewedBy").GetGuid());
        Assert.Equal("Ứng dụng quản lý lớp học", topic);
        Assert.Contains(GroupEventTypes.TopicProposed, await EventsAsync(proposalId));
        Assert.Contains(GroupEventTypes.TopicReviewed, await EventsAsync(proposalId));
    }

    [Fact]
    public async Task Only_the_leader_proposes_and_only_the_lecturer_or_the_office_reviews()
    {
        var (leader, stranger) = (Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false), (stranger, false)]);
        var room = scenario.Rooms[0];
        await JoinAsync(leader, room);

        var byStranger = await ProposeAsync(stranger, room, "Đề tài của người ngoài");
        var created = await DataAsync(await ProposeAsync(leader, room, "Đề tài hợp lệ"), HttpStatusCode.Created);
        var proposalId = created.GetProperty("id").GetGuid();
        var byOtherLecturer = await ReviewAsync(Guid.NewGuid(), proposalId, "Approved", null);
        var byStudent = await PostAsync(stranger, $"/api/v1/topic-proposals/{proposalId}/review", "Approved");

        Assert.Equal(HttpStatusCode.Forbidden, byStranger.StatusCode);
        Assert.Equal("NOT_ROOM_LEADER", await ErrorCodeAsync(byStranger));
        Assert.Equal(HttpStatusCode.Forbidden, byOtherLecturer.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, byStudent.StatusCode);
    }

    [Fact]
    public async Task A_revision_round_is_opened_after_the_lecturer_asks_for_changes()
    {
        var leader = Guid.NewGuid();
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false)]);
        var room = scenario.Rooms[0];
        await JoinAsync(leader, room);
        var first = await DataAsync(await ProposeAsync(leader, room, "Đề tài vòng một"), HttpStatusCode.Created);
        var proposalId = first.GetProperty("id").GetGuid();

        var revised = await DataAsync(await ReviewAsync(scenario.LecturerId, proposalId, "NeedsRevision", "Hãy nêu rõ hơn"));
        var second = await DataAsync(await ProposeAsync(leader, room, "Đề tài vòng hai"), HttpStatusCode.Created);
        var topic = await fixture.QueryAsync(database => database.Rooms.AsNoTracking().Where(item => item.RoomId == room).Select(item => item.Topic).SingleAsync(Ct));

        Assert.Equal("NeedsRevision", revised.GetProperty("status").GetString());
        Assert.Equal(2, second.GetProperty("round").GetInt32());
        Assert.Null(topic);
    }

    [Fact]
    public async Task A_pending_proposal_blocks_the_next_one_and_an_approved_topic_cannot_be_proposed_again()
    {
        var leader = Guid.NewGuid();
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false)]);
        var room = scenario.Rooms[0];
        await JoinAsync(leader, room);
        var first = await DataAsync(await ProposeAsync(leader, room, "Đề tài một"), HttpStatusCode.Created);
        var proposalId = first.GetProperty("id").GetGuid();

        var blocked = await ProposeAsync(leader, room, "Đề tài hai");
        await DataAsync(await ReviewAsync(scenario.LecturerId, proposalId, "Approved", null));
        var afterApproval = await ProposeAsync(leader, room, "Đề tài ba");

        Assert.Equal(HttpStatusCode.Conflict, blocked.StatusCode);
        Assert.Equal("TOPIC_PROPOSAL_PENDING", await ErrorCodeAsync(blocked));
        Assert.Equal(HttpStatusCode.Conflict, afterApproval.StatusCode);
        Assert.Equal("TOPIC_PROPOSAL_APPROVED", await ErrorCodeAsync(afterApproval));
    }

    [Fact]
    public async Task The_proposals_are_listed_for_the_lecturer_and_hidden_from_other_students()
    {
        var (leader, other) = (Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false), (other, false)]);
        var room = scenario.Rooms[0];
        await JoinAsync(leader, room);
        await DataAsync(await ProposeAsync(leader, room, "Đề tài của nhóm"), HttpStatusCode.Created);

        var forLecturer = await DataAsync(await fixture.Api.ClientAs(Roles.Lecturer, scenario.LecturerId).GetAsync($"/api/v1/topic-proposals?courseId={scenario.CourseId}", Ct));
        var forOther = await As(other).GetAsync("/api/v1/topic-proposals", Ct);
        var forAdmin = await DataAsync(await fixture.Api.ClientAs(Roles.Administrator).GetAsync($"/api/v1/topic-proposals?courseId={scenario.CourseId}", Ct));

        Assert.Single(forLecturer.EnumerateArray());
        Assert.Single(forAdmin.EnumerateArray());
        Assert.Equal(HttpStatusCode.Forbidden, forOther.StatusCode);
    }

    private Task<HttpResponseMessage> ProposeAsync(Guid studentId, Guid roomId, string topic, string? description = null) =>
        As(studentId).PostAsJsonAsync($"/api/v1/topic-proposals?roomId={roomId}", new { topic, description }, Ct);

    private Task<HttpResponseMessage> ReviewAsync(Guid lecturerId, Guid proposalId, string decision, string? note) =>
        fixture.Api.ClientAs(Roles.Lecturer, lecturerId).PostAsJsonAsync($"/api/v1/topic-proposals/{proposalId}/review", new { decision, note }, Ct);

    private Task<HttpResponseMessage> JoinAsync(Guid studentId, Guid roomId) => PostAsync(studentId, $"/api/v1/rooms/{roomId}/join");

    private Task<HttpResponseMessage> PostAsync(Guid studentId, string route, string decision) =>
        As(studentId).PostAsJsonAsync(route, new { decision }, Ct);

    private Task<HttpResponseMessage> PostAsync(Guid studentId, string route) =>
        As(studentId).PostAsync(route, null, Ct);

    private HttpClient As(Guid studentId) => RoomScenario.As(fixture, studentId);

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
