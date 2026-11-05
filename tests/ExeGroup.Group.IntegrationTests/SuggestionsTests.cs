using System.Diagnostics;
using System.Net;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RecommendationClient = ExeGroup.Contracts.Recommendation.Recommendation.RecommendationClient;

namespace ExeGroup.Group.IntegrationTests;

public sealed class SuggestionsFixture : GroupApiFixture
{
    public FakeRecommendationServer Recommendation { get; private set; } = null!;

    public override async ValueTask InitializeAsync()
    {
        Recommendation = await FakeRecommendationServer.StartAsync();
        await base.InitializeAsync();
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        await Recommendation.DisposeAsync();
    }

    protected override void ConfigureServices(IServiceCollection services) =>
        services.AddGrpcClient<RecommendationClient>().ConfigurePrimaryHttpMessageHandler(() => Recommendation.CreateHandler());
}

public sealed class SuggestionsTests(SuggestionsFixture fixture) : IClassFixture<SuggestionsFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private FakeRecommendationState Fake => fixture.Recommendation.State;

    [Fact]
    public async Task Rooms_come_back_ranked_with_reasons_and_the_correlation_id_reaches_grpc()
    {
        Fake.Mode = FakeRecommendationMode.Rank;
        var (me, member) = (Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(me, true), (member, false)], rooms: 3, aiRequired: 1);
        var skill = await SeedSkillAsync(scenario, member, level: 4);
        await JoinAsync(scenario.Rooms[0], member);
        var (seCode, aiCode) = await MajorCodesAsync(scenario);

        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/courses/{scenario.CourseId}/rooms/suggestions?top=2");
        request.Headers.Add(CorrelationContext.HeaderName, "corr-suggest-1");
        var data = await DataAsync(await RoomScenario.As(fixture, me).SendAsync(request, Ct));

        Assert.True(data.GetProperty("ranked").GetBoolean());
        var rooms = data.GetProperty("rooms").EnumerateArray().ToList();
        Assert.Equal(new[] { "Room 3", "Room 2" }, rooms.Select(room => room.GetProperty("room").GetProperty("name").GetString()));
        Assert.Equal(10, rooms[0].GetProperty("score").GetDouble());
        var reason = Assert.Single(rooms[0].GetProperty("reasons").EnumerateArray());
        Assert.Equal(("MAJOR_NEEDED", aiCode), (reason.GetProperty("code").GetString(), reason.GetProperty("detail").GetString()));

        var sent = Fake.RoomsRequest!;
        Assert.Equal("corr-suggest-1", Fake.CorrelationId);
        Assert.Equal((me.ToString(), aiCode, 2), (sent.Student.StudentId, sent.Student.MajorCode, sent.Top));
        Assert.Equal(3, sent.Rooms.Count);
        var occupied = sent.Rooms.Single(room => room.RoomId == scenario.Rooms[0].ToString());
        var seated = Assert.Single(occupied.Members);
        Assert.Equal((seCode, 4), (seated.MajorCode, seated.Skills[skill]));
        Assert.Equal(1, occupied.MinPerMajor[aiCode]);
        Assert.Equal(2, occupied.MinGroupSize);
    }

    [Fact]
    public async Task A_failing_recommendation_service_leaves_the_joinable_rooms_unranked()
    {
        Fake.Mode = FakeRecommendationMode.Fail;
        var (me, member) = (Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(me, false), (member, false)], capacity: 2, rooms: 2, aiRequired: 1);
        await JoinAsync(scenario.Rooms[0], member);

        var data = await DataAsync(await RoomScenario.As(fixture, me).GetAsync($"/api/v1/courses/{scenario.CourseId}/rooms/suggestions", Ct));

        Assert.False(data.GetProperty("ranked").GetBoolean());
        var room = Assert.Single(data.GetProperty("rooms").EnumerateArray());
        Assert.Equal(scenario.Rooms[1], room.GetProperty("room").GetProperty("id").GetGuid());
        Assert.Equal(JsonValueKind.Null, room.GetProperty("score").ValueKind);
        Assert.Empty(room.GetProperty("reasons").EnumerateArray());
    }

    [Fact]
    public async Task A_slow_recommendation_service_is_cut_off_at_the_deadline()
    {
        Fake.Mode = FakeRecommendationMode.Hang;
        var me = Guid.NewGuid();
        var scenario = await RoomScenario.CreateAsync(fixture, [(me, false)], rooms: 2);

        var clock = Stopwatch.StartNew();
        var data = await DataAsync(await RoomScenario.As(fixture, me).GetAsync($"/api/v1/courses/{scenario.CourseId}/rooms/suggestions", Ct));
        clock.Stop();

        Assert.False(data.GetProperty("ranked").GetBoolean());
        Assert.Equal(2, data.GetProperty("rooms").GetArrayLength());
        Assert.InRange(clock.Elapsed, TimeSpan.FromSeconds(1.5), TimeSpan.FromSeconds(8));
    }

    [Fact]
    public async Task Room_suggestions_need_a_published_course_and_an_enrolled_student()
    {
        Fake.Mode = FakeRecommendationMode.Rank;
        var (me, setupStudent) = (Guid.NewGuid(), Guid.NewGuid());
        var published = await RoomScenario.CreateAsync(fixture, [(me, false)]);
        var setup = await RoomScenario.CreateAsync(fixture, [(setupStudent, false)], phase: CoursePhases.Setup);

        var outsider = await RoomScenario.As(fixture, Guid.NewGuid()).GetAsync($"/api/v1/courses/{published.CourseId}/rooms/suggestions", Ct);
        var notPublished = await RoomScenario.As(fixture, setupStudent).GetAsync($"/api/v1/courses/{setup.CourseId}/rooms/suggestions", Ct);
        var badTop = await RoomScenario.As(fixture, me).GetAsync($"/api/v1/courses/{published.CourseId}/rooms/suggestions?top=0", Ct);
        var lecturer = await fixture.Api.ClientAs(Roles.Lecturer, published.LecturerId).GetAsync($"/api/v1/courses/{published.CourseId}/rooms/suggestions", Ct);

        Assert.Equal("NOT_ENROLLED", await ErrorCodeAsync(outsider, HttpStatusCode.Conflict));
        Assert.Equal("COURSE_NOT_PUBLISHED", await ErrorCodeAsync(notPublished, HttpStatusCode.Conflict));
        Assert.Equal(HttpStatusCode.BadRequest, badTop.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, lecturer.StatusCode);
    }

    [Fact]
    public async Task Placement_suggestions_come_after_the_deadline_and_survive_an_outage()
    {
        var (placed, first, second) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var expired = await RoomScenario.CreateAsync(fixture, [(placed, false), (first, false), (second, false)], rooms: 2, phase: CoursePhases.Expired);
        var published = await RoomScenario.CreateAsync(fixture, [(Guid.NewGuid(), false)]);
        await JoinAsync(expired.Rooms[1], placed);
        var admin = fixture.Api.ClientAs(Roles.Administrator);
        var route = $"/api/v1/courses/{expired.CourseId}/placement-suggestions";

        Fake.Mode = FakeRecommendationMode.Rank;
        var ranked = await DataAsync(await admin.GetAsync(route, Ct));
        var sent = Fake.PlacementsRequest!;
        Fake.Mode = FakeRecommendationMode.Fail;
        var unranked = await DataAsync(await admin.GetAsync(route, Ct));
        var tooEarly = await admin.GetAsync($"/api/v1/courses/{published.CourseId}/placement-suggestions", Ct);
        var asStudent = await RoomScenario.As(fixture, first).GetAsync(route, Ct);

        Assert.Equal(2, sent.Unassigned.Count);
        Assert.DoesNotContain(sent.Unassigned, student => student.StudentId == placed.ToString());
        Assert.Equal(placed.ToString(), Assert.Single(Assert.Single(sent.Rooms, room => room.RoomId == expired.Rooms[1].ToString()).Members).StudentId);
        Assert.True(ranked.GetProperty("ranked").GetBoolean());
        var placement = Assert.Single(ranked.GetProperty("placements").EnumerateArray());
        Assert.Equal("Room 1", placement.GetProperty("roomName").GetString());
        Assert.Equal("BELOW_MINIMUM", Assert.Single(placement.GetProperty("reasons").EnumerateArray()).GetProperty("code").GetString());
        Assert.Single(ranked.GetProperty("unplaced").EnumerateArray());
        Assert.Equal(2, ranked.GetProperty("rooms").GetArrayLength());
        Assert.False(unranked.GetProperty("ranked").GetBoolean());
        Assert.Empty(unranked.GetProperty("placements").EnumerateArray());
        Assert.Equal(2, unranked.GetProperty("unplaced").GetArrayLength());
        Assert.Equal("COURSE_NOT_EXPIRED", await ErrorCodeAsync(tooEarly, HttpStatusCode.Conflict));
        Assert.Equal(HttpStatusCode.Forbidden, asStudent.StatusCode);
    }

    [Fact]
    public async Task Both_suggestion_endpoints_are_in_swagger()
    {
        var document = await fixture.Api.AnonymousClient().GetStringAsync("/swagger/v1/swagger.json", Ct);
        var paths = JsonDocument.Parse(document).RootElement.GetProperty("paths");

        Assert.True(paths.TryGetProperty("/api/v1/courses/{courseId}/rooms/suggestions", out _));
        Assert.True(paths.TryGetProperty("/api/v1/courses/{courseId}/placement-suggestions", out _));
    }

    private Task JoinAsync(Guid roomId, Guid studentId) =>
        fixture.SeedAsync(database => database.Join(database.Rooms.Single(room => room.RoomId == roomId), studentId), Ct);

    private async Task<string> SeedSkillAsync(RoomScenario scenario, Guid studentId, byte level)
    {
        var code = string.Empty;
        await fixture.SeedAsync(
            database =>
            {
                var skill = database.Skill();
                code = skill.Code;
                database.StudentSkills.Add(new StudentSkill { SemesterId = scenario.SemesterId, StudentId = studentId, SkillId = skill.SkillId, Level = level });
            },
            Ct);
        return code;
    }

    private Task<(string Se, string Ai)> MajorCodesAsync(RoomScenario scenario) =>
        fixture.QueryAsync(async database =>
        {
            var codes = await database.Majors.AsNoTracking()
                .Where(major => major.MajorId == scenario.Se || major.MajorId == scenario.Ai)
                .ToDictionaryAsync(major => major.MajorId, major => major.Code, Ct);
            return (codes[scenario.Se], codes[scenario.Ai]);
        });

    private static async Task<JsonElement> DataAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.GetProperty("data");
    }

    private static async Task<string?> ErrorCodeAsync(HttpResponseMessage response, HttpStatusCode expected)
    {
        Assert.Equal(expected, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.GetProperty("errors")[0].GetProperty("code").GetString();
    }
}
