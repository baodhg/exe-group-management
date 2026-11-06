using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Services.Events;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Group.IntegrationTests;

public sealed class JoinRequestsTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Applying_is_refused_with_the_reason_in_its_code()
    {
        var (leader, removed, applicant, member, outsider, late, setupStudent, fullApplicant) =
            (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false), (removed, false), (applicant, false), (member, false)], rooms: 2);
        var (locked, open) = (scenario.Rooms[0], scenario.Rooms[1]);
        var full = await RoomScenario.CreateAsync(fixture, [(late, false), (fullApplicant, false)], capacity: 1);
        var setup = await RoomScenario.CreateAsync(fixture, [(setupStudent, false)], phase: CoursePhases.Setup);
        await fixture.SeedAsync(database => database.Rooms.Single(room => room.RoomId == setup.Rooms[0]).Status = RoomStatuses.Locked, Ct);
        await JoinAsync(leader, locked);
        await JoinAsync(removed, locked);
        await As(leader).PostAsJsonAsync($"/api/v1/rooms/{locked}/members/{removed}/remove", new { reason = "Never came" }, Ct);
        await PostAsync(leader, $"/api/v1/rooms/{locked}/lock");
        await JoinAsync(member, open);
        await JoinAsync(late, full.Rooms[0]);
        await PostAsync(late, $"/api/v1/rooms/{full.Rooms[0]}/lock");

        var first = await ApplyAsync(applicant, locked, "I build the back end");
        var cases = new Dictionary<string, HttpResponseMessage>
        {
            ["APPLICATION_PENDING"] = await ApplyAsync(applicant, locked),
            ["ROOM_NOT_LOCKED"] = await ApplyAsync(applicant, open),
            ["ALREADY_IN_ROOM"] = await ApplyAsync(member, locked),
            ["REMOVED_FROM_ROOM"] = await ApplyAsync(removed, locked),
            ["NOT_ENROLLED"] = await ApplyAsync(outsider, locked),
            ["ROOM_FULL"] = await ApplyAsync(fullApplicant, full.Rooms[0]),
            ["COURSE_NOT_PUBLISHED"] = await ApplyAsync(setupStudent, setup.Rooms[0]),
        };

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        var created = await DataAsync(first, HttpStatusCode.Created);
        Assert.Equal("Pending", created.GetProperty("status").GetString());
        Assert.Equal("I build the back end", created.GetProperty("message").GetString());
        foreach (var (code, response) in cases)
        {
            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            Assert.Equal(code, await ErrorCodeAsync(response));
        }

        var submitted = await EventsAsync(created.GetProperty("id").GetGuid());
        Assert.Equal(GroupEventTypes.JoinRequestSubmitted, Assert.Single(submitted));
    }

    [Fact]
    public async Task Approval_adds_the_applicant_and_cancels_their_other_applications()
    {
        var (leader, otherLeader, applicant, stranger) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false), (otherLeader, false), (applicant, false), (stranger, false)], rooms: 2);
        var (room, otherRoom) = (scenario.Rooms[0], scenario.Rooms[1]);
        await LeadLockedRoomAsync(leader, room);
        await LeadLockedRoomAsync(otherLeader, otherRoom);
        var requestId = await IdAsync(await ApplyAsync(applicant, room));
        var otherRequestId = await IdAsync(await ApplyAsync(applicant, otherRoom));

        var byStranger = await PostAsync(stranger, $"/api/v1/join-requests/{requestId}/approve");
        var approved = await DataAsync(await PostAsync(leader, $"/api/v1/join-requests/{requestId}/approve"));
        var again = await PostAsync(leader, $"/api/v1/join-requests/{requestId}/approve");
        var other = await RequestAsync(otherRequestId);
        var membership = await fixture.QueryAsync(database => database.RoomMembers.AsNoTracking()
            .SingleAsync(item => item.CourseId == scenario.CourseId && item.StudentId == applicant && item.EndedAt == null, Ct));
        var memberCount = await fixture.QueryAsync(database => database.Rooms.AsNoTracking().Where(item => item.RoomId == room).Select(item => item.MemberCount).SingleAsync(Ct));

        Assert.Equal(HttpStatusCode.Forbidden, byStranger.StatusCode);
        Assert.Equal("NOT_ROOM_LEADER", await ErrorCodeAsync(byStranger));
        Assert.Equal("Approved", approved.GetProperty("status").GetString());
        Assert.Equal(leader, approved.GetProperty("decidedBy").GetGuid());
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Equal("REQUEST_NOT_PENDING", await ErrorCodeAsync(again));
        Assert.Equal((room, JoinMethods.Application), (membership.RoomId, membership.JoinedVia));
        Assert.Equal(2, memberCount);
        Assert.Equal((JoinRequestStatuses.Cancelled, JoinRequestReasons.JoinedAnotherRoom), (other.Status, other.ReasonCode));
        var events = await EventsAsync(requestId, room);
        Assert.Contains(GroupEventTypes.JoinRequestDecided, events);
        Assert.Contains(GroupEventTypes.RoomMemberJoined, events);
    }

    [Fact]
    public async Task Filling_the_room_rejects_the_rest_and_the_majors_are_checked_again()
    {
        var (leader, first, second, ai) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var full = await RoomScenario.CreateAsync(fixture, [(leader, false), (first, false), (second, false)], capacity: 2);
        await LeadLockedRoomAsync(leader, full.Rooms[0]);
        var firstId = await IdAsync(await ApplyAsync(first, full.Rooms[0]));
        var secondId = await IdAsync(await ApplyAsync(second, full.Rooms[0]));
        var (seLeader, seA, seB) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var mixed = await RoomScenario.CreateAsync(fixture, [(seLeader, false), (seA, false), (seB, false), (ai, true)], aiRequired: 1);
        await LeadLockedRoomAsync(seLeader, mixed.Rooms[0]);
        var seAId = await IdAsync(await ApplyAsync(seA, mixed.Rooms[0]));
        var seBId = await IdAsync(await ApplyAsync(seB, mixed.Rooms[0]));

        await DataAsync(await PostAsync(leader, $"/api/v1/join-requests/{firstId}/approve"));
        await DataAsync(await PostAsync(seLeader, $"/api/v1/join-requests/{seAId}/approve"));
        var composition = await DataAsync(await PostAsync(seLeader, $"/api/v1/join-requests/{seBId}/approve"));
        var aiApplication = await ApplyAsync(ai, mixed.Rooms[0]);

        var rest = await RequestAsync(secondId);
        Assert.Equal((JoinRequestStatuses.Rejected, JoinRequestReasons.RoomFull), (rest.Status, rest.ReasonCode));
        Assert.Equal("Rejected", composition.GetProperty("status").GetString());
        Assert.Equal("COMPOSITION_RULE", composition.GetProperty("reasonCode").GetString());
        Assert.Equal(HttpStatusCode.Created, aiApplication.StatusCode);
    }

    [Fact]
    public async Task Two_approvals_for_the_last_seat_end_with_one_approved_and_one_rejected()
    {
        var (leader, racerA, racerB) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false), (racerA, false), (racerB, false)], capacity: 2);
        var room = scenario.Rooms[0];
        await LeadLockedRoomAsync(leader, room);
        var requestA = await IdAsync(await ApplyAsync(racerA, room));
        var requestB = await IdAsync(await ApplyAsync(racerB, room));

        var responses = await Task.WhenAll(
            PostAsync(leader, $"/api/v1/join-requests/{requestA}/approve"),
            PostAsync(leader, $"/api/v1/join-requests/{requestB}/approve"));
        var statuses = await fixture.QueryAsync(database => database.JoinRequests.AsNoTracking()
            .Where(item => item.RoomId == room)
            .Select(item => item.Status)
            .ToListAsync(Ct));
        var members = await fixture.QueryAsync(database => database.RoomMembers.CountAsync(item => item.RoomId == room && item.EndedAt == null, Ct));

        Assert.All(responses, response => Assert.Contains(response.StatusCode, new[] { HttpStatusCode.OK, HttpStatusCode.Conflict }));
        Assert.Contains(responses, response => response.StatusCode == HttpStatusCode.OK);
        Assert.Single(statuses, status => status == JoinRequestStatuses.Approved);
        Assert.Single(statuses, status => status == JoinRequestStatuses.Rejected);
        Assert.Equal(2, members);
    }

    [Fact]
    public async Task Rejecting_and_withdrawing_record_their_reasons()
    {
        var (leader, applicant, other) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false), (applicant, false), (other, false)]);
        var room = scenario.Rooms[0];
        await LeadLockedRoomAsync(leader, room);
        var rejectedId = await IdAsync(await ApplyAsync(applicant, room));

        var rejected = await DataAsync(await As(leader).PostAsJsonAsync($"/api/v1/join-requests/{rejectedId}/reject", new { reasonText = "We need a designer" }, Ct));
        var withdrawnId = await IdAsync(await ApplyAsync(applicant, room));
        var byOther = await PostAsync(other, $"/api/v1/join-requests/{withdrawnId}/withdraw");
        var withdrawn = await DataAsync(await PostAsync(applicant, $"/api/v1/join-requests/{withdrawnId}/withdraw"));
        var twice = await PostAsync(applicant, $"/api/v1/join-requests/{withdrawnId}/withdraw");

        Assert.Equal("Rejected", rejected.GetProperty("status").GetString());
        Assert.Equal("REJECTED_BY_LEADER", rejected.GetProperty("reasonCode").GetString());
        Assert.Equal("We need a designer", rejected.GetProperty("reasonText").GetString());
        Assert.Equal(HttpStatusCode.Forbidden, byOther.StatusCode);
        Assert.Equal("Cancelled", withdrawn.GetProperty("status").GetString());
        Assert.Equal("WITHDRAWN", withdrawn.GetProperty("reasonCode").GetString());
        Assert.Equal("REQUEST_NOT_PENDING", await ErrorCodeAsync(twice));
    }

    [Fact]
    public async Task Lists_show_my_applications_the_room_I_lead_and_everything_for_administrators()
    {
        var (leader, applicantA, applicantB) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false), (applicantA, false), (applicantB, false)]);
        var room = scenario.Rooms[0];
        await LeadLockedRoomAsync(leader, room);
        var skillCode = string.Empty;
        await fixture.SeedAsync(
            database =>
            {
                var skill = database.Skill();
                skillCode = skill.Code;
                database.StudentSkills.Add(new StudentSkill { SemesterId = scenario.SemesterId, StudentId = applicantA, SkillId = skill.SkillId, Level = 4 });
            },
            Ct);
        var majorCode = await fixture.QueryAsync(database => database.Majors.Where(major => major.MajorId == scenario.Se).Select(major => major.Code).SingleAsync(Ct));
        var requestA = await IdAsync(await ApplyAsync(applicantA, room));
        await ApplyAsync(applicantB, room);

        var forLeader = await DataAsync(await As(leader).GetAsync($"/api/v1/join-requests?roomId={room}", Ct));
        var mine = await DataAsync(await As(applicantA).GetAsync($"/api/v1/join-requests?roomId={room}", Ct));
        var forAdmin = await DataAsync(await fixture.Api.ClientAs(Roles.Administrator).GetAsync($"/api/v1/join-requests?courseId={scenario.CourseId}&status=pending&sort=studentCode", Ct));
        var approvedOnly = await DataAsync(await As(leader).GetAsync($"/api/v1/join-requests?roomId={room}&status=Approved", Ct));
        var badStatus = await As(leader).GetAsync("/api/v1/join-requests?status=Waiting", Ct);
        var byLeader = await As(leader).GetAsync($"/api/v1/join-requests/{requestA}", Ct);
        var byOtherApplicant = await As(applicantB).GetAsync($"/api/v1/join-requests/{requestA}", Ct);

        Assert.Equal(2, forLeader.GetArrayLength());
        var fromA = forLeader.EnumerateArray().Single(item => item.GetProperty("id").GetGuid() == requestA);
        Assert.Equal(majorCode, fromA.GetProperty("majorCode").GetString());
        var rated = Assert.Single(fromA.GetProperty("skills").EnumerateArray());
        Assert.Equal((skillCode, 4), (rated.GetProperty("skillCode").GetString(), rated.GetProperty("level").GetInt32()));
        Assert.Equal(requestA, Assert.Single(mine.EnumerateArray()).GetProperty("id").GetGuid());
        Assert.Equal(2, forAdmin.GetArrayLength());
        Assert.Equal(0, approvedOnly.GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest, badStatus.StatusCode);
        Assert.Equal(HttpStatusCode.OK, byLeader.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, byOtherApplicant.StatusCode);
    }

    private async Task LeadLockedRoomAsync(Guid leader, Guid roomId)
    {
        await DataAsync(await JoinAsync(leader, roomId));
        await DataAsync(await PostAsync(leader, $"/api/v1/rooms/{roomId}/lock"));
    }

    private Task<HttpResponseMessage> ApplyAsync(Guid studentId, Guid roomId, string? message = null) =>
        As(studentId).PostAsJsonAsync("/api/v1/join-requests", new { roomId, message }, Ct);

    private Task<HttpResponseMessage> JoinAsync(Guid studentId, Guid roomId) => PostAsync(studentId, $"/api/v1/rooms/{roomId}/join");

    private Task<HttpResponseMessage> PostAsync(Guid studentId, string route) => As(studentId).PostAsync(route, null, Ct);

    private HttpClient As(Guid studentId) => RoomScenario.As(fixture, studentId);

    private Task<JoinRequest> RequestAsync(Guid requestId) =>
        fixture.QueryAsync(database => database.JoinRequests.AsNoTracking().SingleAsync(item => item.RequestId == requestId, Ct));

    private Task<List<string>> EventsAsync(params Guid[] aggregateIds) =>
        fixture.QueryAsync(database => database.OutboxEvents.AsNoTracking()
            .Where(item => aggregateIds.Contains(item.AggregateId))
            .Select(item => item.EventType)
            .ToListAsync(Ct));

    private static async Task<Guid> IdAsync(HttpResponseMessage response) =>
        (await DataAsync(response, HttpStatusCode.Created)).GetProperty("id").GetGuid();

    private static async Task<JsonElement> DataAsync(HttpResponseMessage response, HttpStatusCode expected = HttpStatusCode.OK)
    {
        Assert.Equal(expected, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.GetProperty("data");
    }

    private static async Task<string?> ErrorCodeAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.GetProperty("errors")[0].GetProperty("code").GetString();
}
