using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Services.Events;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Group.IntegrationTests;

public sealed class RoomMembershipTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task The_first_student_leads_and_leadership_passes_to_the_earliest_member()
    {
        var (first, second, third) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(first, false), (second, false), (third, false)]);
        var room = scenario.Rooms[0];

        var joined = await DataAsync(await JoinAsync(first, room));
        await JoinAsync(second, room);
        await JoinAsync(third, room);
        var afterLeaderLeft = await DataAsync(await PostAsync(first, $"/api/v1/rooms/{room}/leave"));
        await PostAsync(second, $"/api/v1/rooms/{room}/leave");
        var empty = await DataAsync(await PostAsync(third, $"/api/v1/rooms/{room}/leave"));

        Assert.Equal(first, joined.GetProperty("leaderId").GetGuid());
        Assert.Equal(second, afterLeaderLeft.GetProperty("leaderId").GetGuid());
        Assert.Equal(2, afterLeaderLeft.GetProperty("memberCount").GetInt32());
        Assert.Equal(0, empty.GetProperty("memberCount").GetInt32());
        Assert.Equal(JsonValueKind.Null, empty.GetProperty("leaderId").ValueKind);
    }

    [Fact]
    public async Task Joining_is_refused_with_the_reason_in_its_code()
    {
        var (setupStudent, outsider, member, full, se1, se2) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var setup = await RoomScenario.CreateAsync(fixture, [(setupStudent, false)], phase: CoursePhases.Setup);
        var published = await RoomScenario.CreateAsync(fixture, [(member, false), (full, false)], capacity: 1, rooms: 2);
        var composition = await RoomScenario.CreateAsync(fixture, [(se1, false), (se2, false)], capacity: 2, aiRequired: 1);

        await JoinAsync(member, published.Rooms[0]);
        var cases = new Dictionary<string, HttpResponseMessage>
        {
            ["COURSE_NOT_PUBLISHED"] = await JoinAsync(setupStudent, setup.Rooms[0]),
            ["NOT_ENROLLED"] = await JoinAsync(outsider, published.Rooms[0]),
            ["ALREADY_IN_ROOM"] = await JoinAsync(member, published.Rooms[1]),
            ["ROOM_FULL"] = await JoinAsync(full, published.Rooms[0]),
        };
        await JoinAsync(se1, composition.Rooms[0]);
        cases["COMPOSITION_RULE"] = await JoinAsync(se2, composition.Rooms[0]);

        foreach (var (code, response) in cases)
        {
            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            Assert.Equal(code, await ErrorCodeAsync(response));
        }
    }

    [Fact]
    public async Task Two_students_racing_for_the_last_seat_end_with_one_member()
    {
        var (leader, racerA, racerB) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false), (racerA, false), (racerB, false)], capacity: 2);
        var room = scenario.Rooms[0];
        await JoinAsync(leader, room);

        var responses = await Task.WhenAll(JoinAsync(racerA, room), JoinAsync(racerB, room));
        var members = await fixture.QueryAsync(database => database.RoomMembers.CountAsync(member => member.RoomId == room && member.EndedAt == null, Ct));

        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.OK);
        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(2, members);
    }

    [Fact]
    public async Task The_leader_locks_removes_and_hands_over_while_others_are_refused()
    {
        var (leader, member, newcomer) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false), (member, false), (newcomer, false)]);
        var room = scenario.Rooms[0];
        await JoinAsync(leader, room);
        await JoinAsync(member, room);

        var lockedByMember = await PostAsync(member, $"/api/v1/rooms/{room}/lock");
        var locked = await DataAsync(await PostAsync(leader, $"/api/v1/rooms/{room}/lock"));
        var joinLocked = await JoinAsync(newcomer, room);
        await PostAsync(leader, $"/api/v1/rooms/{room}/unlock");
        var noReason = await RoomScenario.As(fixture, leader).PostAsJsonAsync($"/api/v1/rooms/{room}/members/{member}/remove", new { reason = "" }, Ct);
        await RoomScenario.As(fixture, leader).PostAsJsonAsync($"/api/v1/rooms/{room}/members/{member}/remove", new { reason = "Did not take part" }, Ct);
        var rejoin = await JoinAsync(member, room);
        await JoinAsync(newcomer, room);
        var handedOver = await DataAsync(await RoomScenario.As(fixture, leader).PostAsJsonAsync($"/api/v1/rooms/{room}/leader", new { studentId = newcomer }, Ct));

        Assert.Equal(HttpStatusCode.Forbidden, lockedByMember.StatusCode);
        Assert.Equal("NOT_ROOM_LEADER", await ErrorCodeAsync(lockedByMember));
        Assert.Equal("Locked", locked.GetProperty("status").GetString());
        Assert.Equal("ROOM_LOCKED", await ErrorCodeAsync(joinLocked));
        Assert.Equal(HttpStatusCode.BadRequest, noReason.StatusCode);
        Assert.Equal("REMOVED_FROM_ROOM", await ErrorCodeAsync(rejoin));
        Assert.Equal(newcomer, handedOver.GetProperty("leaderId").GetGuid());
    }

    [Fact]
    public async Task After_the_deadline_the_leader_cannot_change_the_room()
    {
        var leader = Guid.NewGuid();
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false)]);
        var room = scenario.Rooms[0];
        await JoinAsync(leader, room);
        await fixture.SeedAsync(database => database.Courses.Single(course => course.CourseId == scenario.CourseId).Phase = CoursePhases.Expired, Ct);

        var response = await PostAsync(leader, $"/api/v1/rooms/{room}/lock");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("COURSE_NOT_PUBLISHED", await ErrorCodeAsync(response));
    }

    [Fact]
    public async Task Joining_cancels_my_other_applications_and_records_the_events()
    {
        var (leader, applicant) = (Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false), (applicant, false)], rooms: 2);
        await JoinAsync(leader, scenario.Rooms[1]);
        var requestId = Guid.NewGuid();
        await fixture.SeedAsync(
            database =>
            {
                database.Rooms.Single(room => room.RoomId == scenario.Rooms[1]).Status = RoomStatuses.Locked;
                database.JoinRequests.Add(new JoinRequest { RequestId = requestId, RoomId = scenario.Rooms[1], CourseId = scenario.CourseId, StudentId = applicant });
            },
            Ct);

        await JoinAsync(applicant, scenario.Rooms[0]);
        var request = await fixture.QueryAsync(database => database.JoinRequests.AsNoTracking().SingleAsync(item => item.RequestId == requestId, Ct));
        var events = await fixture.QueryAsync(database => database.OutboxEvents.AsNoTracking()
            .Where(item => item.AggregateId == scenario.Rooms[0] || item.AggregateId == requestId)
            .Select(item => item.EventType)
            .ToListAsync(Ct));

        Assert.Equal((JoinRequestStatuses.Cancelled, JoinRequestReasons.JoinedAnotherRoom), (request.Status, request.ReasonCode));
        Assert.Contains(GroupEventTypes.RoomMemberJoined, events);
        Assert.Contains(GroupEventTypes.RoomLeaderChanged, events);
        Assert.Contains(GroupEventTypes.JoinRequestDecided, events);
    }

    private Task<HttpResponseMessage> JoinAsync(Guid studentId, Guid roomId) => PostAsync(studentId, $"/api/v1/rooms/{roomId}/join");

    private Task<HttpResponseMessage> PostAsync(Guid studentId, string route) => RoomScenario.As(fixture, studentId).PostAsync(route, null, Ct);

    private static async Task<JsonElement> DataAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.GetProperty("data");
    }

    private static async Task<string?> ErrorCodeAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.GetProperty("errors")[0].GetProperty("code").GetString();
}
