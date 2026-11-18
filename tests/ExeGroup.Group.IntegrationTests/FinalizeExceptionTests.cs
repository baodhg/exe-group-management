using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.IntegrationTests;

public sealed class FinalizeExceptionTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;
    private HttpClient Admin => fixture.Api.ClientAs(Roles.Administrator);

    [Fact]
    public async Task Only_the_rooms_named_as_exceptions_may_stay_short_when_the_course_is_finalized()
    {
        var (first, second) = (Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(first, false), (second, false)], rooms: 2, minDistinctMajors: 2);
        await SeatAsync(scenario.Rooms[0], first);
        await SeatAsync(scenario.Rooms[1], second);
        await fixture.SeedAsync(db => db.Courses.Single(course => course.CourseId == scenario.CourseId).Phase = CoursePhases.Expired, Ct);
        var route = $"/api/v1/courses/{scenario.CourseId}/finalize";

        var noException = await Admin.PostAsJsonAsync(route, new { acceptExceptions = false, exceptionRoomIds = Array.Empty<Guid>() }, Ct);
        var wrongRoom = await Admin.PostAsJsonAsync(route, new { acceptExceptions = true, exceptionRoomIds = new[] { scenario.Rooms[0] } }, Ct);
        var bothRooms = await Admin.PostAsJsonAsync(route, new { acceptExceptions = true, exceptionRoomIds = new[] { scenario.Rooms[0], scenario.Rooms[1] } }, Ct);

        Assert.Equal("FINALIZE_BLOCKED", await ErrorCodeAsync(noException));
        Assert.Equal("FINALIZE_BLOCKED", await ErrorCodeAsync(wrongRoom));
        Assert.Equal(HttpStatusCode.OK, bothRooms.StatusCode);
    }

    [Fact]
    public async Task A_room_outside_the_course_cannot_be_named_as_an_exception()
    {
        var student = Guid.NewGuid();
        var scenario = await RoomScenario.CreateAsync(fixture, [(student, false)], rooms: 1, minDistinctMajors: 2);
        await SeatAsync(scenario.Rooms[0], student);
        await fixture.SeedAsync(db => db.Courses.Single(course => course.CourseId == scenario.CourseId).Phase = CoursePhases.Expired, Ct);

        var response = await Admin.PostAsJsonAsync($"/api/v1/courses/{scenario.CourseId}/finalize", new { acceptExceptions = true, exceptionRoomIds = new[] { Guid.NewGuid() } }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
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

    private static async Task<string?> ErrorCodeAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.GetProperty("errors")[0].GetProperty("code").GetString();
    }
}
