using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Services.Events;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Group.IntegrationTests;

public sealed class ProjectLifecycleTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task The_office_opens_a_milestone_and_every_official_group_gets_a_deliverable()
    {
        var (leader, member) = (Guid.NewGuid(), Guid.NewGuid());
        var scenario = await FinalizedScenarioAsync(fixture, [(leader, false), (member, false)]);
        var room = scenario.Rooms[0];

        var created = await DataAsync(await CreateMilestoneAsync(scenario.CourseId, "Prototype", 2), HttpStatusCode.Created);
        var deliverables = await fixture.QueryAsync(database => database.ProjectDeliverables.AsNoTracking()
            .Where(item => item.CourseId == scenario.CourseId)
            .ToListAsync(Ct));

        Assert.Equal("Prototype", created.GetProperty("name").GetString());
        Assert.Equal(1, created.GetProperty("groupCount").GetInt32());
        Assert.Single(deliverables);
        Assert.Equal(room, deliverables[0].RoomId);
        Assert.Equal(DeliverableStatuses.NotStarted, deliverables[0].Status);
        Assert.Contains(GroupEventTypes.MilestoneCreated, await EventsAsync(created.GetProperty("id").GetGuid()));
    }

    [Fact]
    public async Task The_group_submits_the_deliverable_and_the_lecturer_scores_it()
    {
        var (leader, member) = (Guid.NewGuid(), Guid.NewGuid());
        var scenario = await FinalizedScenarioAsync(fixture, [(leader, false), (member, false)]);
        var milestone = await DataAsync(await CreateMilestoneAsync(scenario.CourseId, "Prototype", 1), HttpStatusCode.Created);
        var milestoneId = milestone.GetProperty("id").GetGuid();
        var deliverableId = await DeliverableIdAsync(scenario.CourseId, scenario.Rooms[0]);

        var byOutsider = await As(Guid.NewGuid()).PostAsync($"/api/v1/courses/{scenario.CourseId}/projects/deliverables/{deliverableId}/submit", null, Ct);
        var tooEarly = await PostAsync(scenario.LecturerId, $"/api/v1/courses/{scenario.CourseId}/projects/deliverables/{deliverableId}/review", "Approved", 8);
        var submitted = await DataAsync(await As(member).PostAsJsonAsync($"/api/v1/courses/{scenario.CourseId}/projects/deliverables/{deliverableId}/submit", new { notes = "Đã xong bản mẫu" }, Ct));
        var reviewed = await DataAsync(await PostAsync(scenario.LecturerId, $"/api/v1/courses/{scenario.CourseId}/projects/deliverables/{deliverableId}/review", "Approved", 8));
        var board = await DataAsync(await fixture.Api.ClientAs(Roles.Lecturer, scenario.LecturerId).GetAsync($"/api/v1/courses/{scenario.CourseId}/projects/board", Ct));

        Assert.Equal(HttpStatusCode.Forbidden, byOutsider.StatusCode);
        Assert.Equal("Submitted", submitted.GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.Conflict, tooEarly.StatusCode);
        Assert.Equal("DELIVERABLE_NOT_SUBMITTED", await ErrorCodeAsync(tooEarly));
        Assert.Equal("Approved", reviewed.GetProperty("status").GetString());
        Assert.Equal(8, reviewed.GetProperty("score").GetDecimal());
        Assert.Equal(100, board.GetProperty("overallPercent").GetInt32());
        Assert.Contains(GroupEventTypes.DeliverableSubmitted, await EventsAsync(deliverableId));
        Assert.Contains(GroupEventTypes.DeliverableReviewed, await EventsAsync(deliverableId));
    }

    [Fact]
    public async Task The_project_lifecycle_only_opens_after_the_course_is_finalized()
    {
        var scenario = await RoomScenario.CreateAsync(fixture, [(Guid.NewGuid(), false)], phase: CoursePhases.Published);

        var response = await CreateMilestoneAsync(scenario.CourseId, "Prototype", 1);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("COURSE_NOT_FINALIZED", await ErrorCodeAsync(response));
    }

    [Fact]
    public async Task A_milestone_name_cannot_be_used_twice_in_the_same_course()
    {
        var scenario = await FinalizedScenarioAsync(fixture, [(Guid.NewGuid(), false)]);
        await DataAsync(await CreateMilestoneAsync(scenario.CourseId, "Prototype", 1), HttpStatusCode.Created);

        var duplicate = await CreateMilestoneAsync(scenario.CourseId, "Prototype", 2);

        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.Equal("MILESTONE_NAME_TAKEN", await ErrorCodeAsync(duplicate));
    }

    [Fact]
    public async Task The_board_shows_the_progress_of_every_official_group()
    {
        var (first, second) = (Guid.NewGuid(), Guid.NewGuid());
        var scenario = await FinalizedScenarioAsync(fixture, [(first, false), (second, false)], rooms: 2);
        await DataAsync(await CreateMilestoneAsync(scenario.CourseId, "Prototype", 1), HttpStatusCode.Created);
        var deliverableId = await DeliverableIdAsync(scenario.CourseId, scenario.Rooms[0]);
        await DataAsync(await As(first).PostAsJsonAsync($"/api/v1/courses/{scenario.CourseId}/projects/deliverables/{deliverableId}/submit", new { notes = "Xong" }, Ct));

        var board = await DataAsync(await fixture.Api.ClientAs(Roles.Administrator).GetAsync($"/api/v1/courses/{scenario.CourseId}/projects/board", Ct));
        var groups = board.GetProperty("groups").EnumerateArray().ToList();

        Assert.Equal(2, groups.Count);
        Assert.Equal(100, groups[0].GetProperty("progressPercent").GetInt32());
        Assert.Equal(0, groups[1].GetProperty("progressPercent").GetInt32());
        Assert.Equal(50, board.GetProperty("overallPercent").GetInt32());
    }

    private static async Task<FinalizedScenario> FinalizedScenarioAsync(GroupApiFixture fixture, IReadOnlyList<(Guid StudentId, bool Ai)> students, int rooms = 1)
    {
        var scenario = await RoomScenario.CreateAsync(fixture, students, rooms: rooms);
        foreach (var student in students)
        {
            await RoomScenario.As(fixture, student.StudentId).PostAsync($"/api/v1/rooms/{scenario.Rooms[0]}/join", null, Ct);
        }

        await fixture.SeedAsync(
            database =>
            {
                var course = database.Courses.Single(item => item.CourseId == scenario.CourseId);
                course.Phase = CoursePhases.Finalized;
                course.FinalizedAt = DateTime.UtcNow;
                for (var index = 0; index < scenario.Rooms.Length; index++)
                {
                    var room = database.Rooms.Single(item => item.RoomId == scenario.Rooms[index]);
                    room.GroupNo = index + 1;
                    room.Status = RoomStatuses.Finalized;
                }
            },
            Ct);
        return new FinalizedScenario(scenario.CourseId, scenario.Rooms, scenario.LecturerId);
    }

    private Task<HttpResponseMessage> CreateMilestoneAsync(Guid courseId, string name, int weight) =>
        fixture.Api.ClientAs(Roles.Administrator).PostAsJsonAsync($"/api/v1/courses/{courseId}/projects/milestones", new { name, weight }, Ct);

    private Task<HttpResponseMessage> PostAsync(Guid lecturerId, string route, string decision, decimal? score) =>
        fixture.Api.ClientAs(Roles.Lecturer, lecturerId).PostAsJsonAsync(route, new { decision, score }, Ct);

    private HttpClient As(Guid studentId) => RoomScenario.As(fixture, studentId);

    private Task<Guid> DeliverableIdAsync(Guid courseId, Guid roomId) =>
        fixture.QueryAsync(database => database.ProjectDeliverables.AsNoTracking()
            .Where(item => item.CourseId == courseId && item.RoomId == roomId)
            .Select(item => item.DeliverableId)
            .FirstAsync(Ct));

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

    private sealed record FinalizedScenario(Guid CourseId, Guid[] Rooms, Guid LecturerId);
}
