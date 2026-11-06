using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Services.Events;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Group.IntegrationTests;

public sealed class CourseProgressTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private HttpClient Admin => fixture.Api.ClientAs(Roles.Administrator);

    [Fact]
    public async Task The_overview_counts_students_and_lists_rooms_missing_members_or_majors()
    {
        var (se1, ai, se2, se3, alone) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(se1, false), (ai, true), (se2, false), (se3, false), (alone, false)], rooms: 3, aiRequired: 1);
        await SeatAsync(scenario.Rooms[0], se1, ai);
        await SeatAsync(scenario.Rooms[1], se2, se3);
        var route = $"/api/v1/courses/{scenario.CourseId}/overview";

        var overview = await DataAsync(await fixture.Api.ClientAs(Roles.Lecturer, scenario.LecturerId).GetAsync(route, Ct));
        var otherLecturer = await fixture.Api.ClientAs(Roles.Lecturer).GetAsync(route, Ct);
        var student = await RoomScenario.As(fixture, se1).GetAsync(route, Ct);
        var admin = await Admin.GetAsync(route, Ct);

        Assert.Equal(
            (5, 4, 3, 1, 1),
            (Int(overview, "studentCount"), Int(overview, "placedCount"), Int(overview, "roomCount"), Int(overview, "emptyRoomCount"), Int(overview, "eligibleRoomCount")));
        Assert.Equal(alone, Assert.Single(overview.GetProperty("unplaced").EnumerateArray()).GetProperty("studentId").GetGuid());
        var room = Assert.Single(overview.GetProperty("ineligibleRooms").EnumerateArray());
        Assert.Equal(scenario.Rooms[1], room.GetProperty("room").GetProperty("id").GetGuid());
        Assert.Equal((0, 1), (Int(room, "missingMembers"), Int(room, "missingMajorSeats")));
        var major = Assert.Single(room.GetProperty("majors").EnumerateArray());
        Assert.Equal((scenario.Ai, 0, 1), (major.GetProperty("majorId").GetGuid(), Int(major, "members"), Int(major, "required")));
        Assert.Equal(HttpStatusCode.Forbidden, otherLecturer.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, student.StatusCode);
        Assert.Equal(HttpStatusCode.OK, admin.StatusCode);
    }

    [Fact]
    public async Task Placements_move_and_place_students_only_after_the_deadline()
    {
        var (leader, member, waiting, outsider) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(leader, false), (member, false), (waiting, false)], capacity: 2, rooms: 2, phase: CoursePhases.Expired);
        var other = await RoomScenario.CreateAsync(fixture, [(Guid.NewGuid(), false)], phase: CoursePhases.Expired);
        var published = await RoomScenario.CreateAsync(fixture, [(Guid.NewGuid(), false)]);
        var (first, second) = (scenario.Rooms[0], scenario.Rooms[1]);
        await SeatAsync(first, leader, member);
        var route = $"/api/v1/courses/{scenario.CourseId}/placements";

        var overflow = await PlaceAsync(route, (waiting, first));
        var notEnrolled = await PlaceAsync(route, (outsider, second));
        var foreignRoom = await PlaceAsync(route, (waiting, other.Rooms[0]));
        var twice = await PlaceAsync(route, (waiting, first), (waiting, second));
        var tooEarly = await PlaceAsync($"/api/v1/courses/{published.CourseId}/placements", (waiting, published.Rooms[0]));
        var placed = await DataAsync(await PlaceAsync(route, (leader, second), (waiting, first)));

        Assert.Equal("ROOM_FULL", await ErrorCodeAsync(overflow));
        Assert.Equal("NOT_ENROLLED", await ErrorCodeAsync(notEnrolled));
        Assert.Equal(HttpStatusCode.BadRequest, foreignRoom.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, twice.StatusCode);
        Assert.Equal("COURSE_NOT_EXPIRED", await ErrorCodeAsync(tooEarly));
        Assert.Equal((3, 0), (Int(placed, "placedCount"), placed.GetProperty("unplaced").GetArrayLength()));

        var memberships = await fixture.QueryAsync(database => database.RoomMembers.AsNoTracking().Where(item => item.CourseId == scenario.CourseId).ToListAsync(Ct));
        var moved = Assert.Single(memberships, item => item.StudentId == leader && item.EndedAt != null);
        Assert.Equal((first, MembershipEndReasons.Moved), (moved.RoomId, moved.EndReason));
        Assert.NotNull(moved.EndedBy);
        Assert.Equal((second, JoinMethods.Admin), Active(memberships, leader));
        Assert.Equal((first, JoinMethods.Admin), Active(memberships, waiting));
        var rooms = await fixture.QueryAsync(database => database.Rooms.AsNoTracking().Where(item => item.CourseId == scenario.CourseId).ToDictionaryAsync(item => item.RoomId, Ct));
        Assert.Equal((2, member), (rooms[first].MemberCount, rooms[first].LeaderId));
        Assert.Equal((1, leader), (rooms[second].MemberCount, rooms[second].LeaderId));
    }

    [Fact]
    public async Task Finalize_needs_everyone_placed_and_accepted_exceptions_then_numbers_the_groups()
    {
        var (se1, ai, se2, se3, late) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(se1, false), (ai, true), (se2, false), (se3, false), (late, false)], rooms: 4, aiRequired: 1, phase: CoursePhases.Expired);
        await SeatAsync(scenario.Rooms[0], se1, ai);
        await SeatAsync(scenario.Rooms[1], se2, se3);
        await fixture.SeedAsync(
            database =>
            {
                var room = scenario.Rooms[3];
                database.RoomMembers.Add(new RoomMember
                {
                    MembershipId = Guid.NewGuid(),
                    RoomId = room,
                    CourseId = scenario.CourseId,
                    StudentId = late,
                    JoinedVia = JoinMethods.Open,
                    EndedAt = DateTime.UtcNow,
                    EndReason = MembershipEndReasons.Left,
                });
                database.JoinRequests.Add(new JoinRequest
                {
                    RequestId = Guid.NewGuid(),
                    RoomId = room,
                    CourseId = scenario.CourseId,
                    StudentId = late,
                    Status = JoinRequestStatuses.Rejected,
                    ReasonCode = JoinRequestReasons.GroupingExpired,
                });
            },
            Ct);
        var route = $"/api/v1/courses/{scenario.CourseId}/finalize";

        var someoneUnplaced = await Admin.PostAsJsonAsync(route, new { acceptExceptions = true }, Ct);
        await DataAsync(await PlaceAsync($"/api/v1/courses/{scenario.CourseId}/placements", (late, scenario.Rooms[0])));
        var withoutExceptions = await Admin.PostAsync(route, null, Ct);
        var finalized = await DataAsync(await Admin.PostAsJsonAsync(route, new { acceptExceptions = true }, Ct));
        var again = await Admin.PostAsJsonAsync(route, new { acceptExceptions = true }, Ct);
        var placeAfter = await PlaceAsync($"/api/v1/courses/{scenario.CourseId}/placements", (late, scenario.Rooms[1]));
        var leaveAfter = await RoomScenario.As(fixture, se2).PostAsync($"/api/v1/rooms/{scenario.Rooms[1]}/leave", null, Ct);
        var topicAfter = await RoomScenario.As(fixture, se1).PutAsJsonAsync($"/api/v1/rooms/{scenario.Rooms[0]}", new { topic = "Too late" }, Ct);

        Assert.Equal("FINALIZE_BLOCKED", await ErrorCodeAsync(someoneUnplaced));
        Assert.Equal("FINALIZE_BLOCKED", await ErrorCodeAsync(withoutExceptions));
        Assert.Equal("Finalized", finalized.GetProperty("course").GetProperty("phase").GetString());
        Assert.Equal((2, 2), (Int(finalized, "groups"), Int(finalized, "deletedRooms")));
        Assert.Equal("COURSE_FINALIZED", await ErrorCodeAsync(again));
        Assert.Equal("COURSE_FINALIZED", await ErrorCodeAsync(placeAfter));
        Assert.Equal("COURSE_NOT_PUBLISHED", await ErrorCodeAsync(leaveAfter));
        Assert.Equal("COURSE_FINALIZED", await ErrorCodeAsync(topicAfter));

        var rooms = await fixture.QueryAsync(database => database.Rooms.AsNoTracking().Where(item => item.CourseId == scenario.CourseId).OrderBy(item => item.GroupNo).ToListAsync(Ct));
        Assert.Equal(new int?[] { 1, 2 }, rooms.Select(room => room.GroupNo));
        Assert.Equal(new[] { scenario.Rooms[0], scenario.Rooms[1] }, rooms.Select(room => room.RoomId));
        Assert.All(rooms, room => Assert.Equal(RoomStatuses.Finalized, room.Status));
        var history = await fixture.QueryAsync(database => database.JoinRequests.CountAsync(item => item.RoomId == scenario.Rooms[3], Ct));
        Assert.Equal(0, history);
        var events = await fixture.QueryAsync(database => database.OutboxEvents.AsNoTracking()
            .Where(item => item.AggregateId == scenario.CourseId || item.AggregateId == scenario.Rooms[0] || item.AggregateId == scenario.Rooms[1])
            .Select(item => item.EventType)
            .ToListAsync(Ct));
        Assert.Single(events, type => type == GroupEventTypes.CoursePhaseChanged);
        Assert.Equal(2, events.Count(type => type == GroupEventTypes.RoomStatusChanged));
    }

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

    private Task<HttpResponseMessage> PlaceAsync(string route, params (Guid StudentId, Guid RoomId)[] placements) =>
        Admin.PostAsJsonAsync(route, new { placements = placements.Select(item => new { studentId = item.StudentId, roomId = item.RoomId }) }, Ct);

    private static (Guid RoomId, string JoinedVia) Active(List<RoomMember> memberships, Guid studentId)
    {
        var membership = Assert.Single(memberships, item => item.StudentId == studentId && item.EndedAt == null);
        return (membership.RoomId, membership.JoinedVia);
    }

    private static int Int(JsonElement element, string name) => element.GetProperty(name).GetInt32();

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
