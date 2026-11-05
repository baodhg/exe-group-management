using ExeGroup.Contracts.Recommendation;
using ExeGroup.Testing;
using Grpc.Core;
using Grpc.Net.Client;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using RecommendationClient = ExeGroup.Contracts.Recommendation.Recommendation.RecommendationClient;

namespace ExeGroup.Recommendation.Tests;

public sealed class RecommendationGrpcTests : IAsyncLifetime
{
    private WebApplicationFactory<Program> _factory = null!;
    private GrpcChannel _channel = null!;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private RecommendationClient Client => new(_channel);

    public ValueTask InitializeAsync()
    {
        _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(host =>
        {
            host.UseEnvironment("Testing");
            foreach (var (key, value) in TestTokens.Configuration)
            {
                host.UseSetting(key, value);
            }
        });
        _channel = GrpcChannel.ForAddress("http://localhost:8081", new GrpcChannelOptions { HttpHandler = _factory.Server.CreateHandler() });
        return ValueTask.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        _channel.Dispose();
        await _factory.DisposeAsync();
    }

    [Fact]
    public async Task Rooms_are_ranked_over_grpc_with_their_reasons()
    {
        var needsAi = new Room { RoomId = "needs-ai", Name = "A", Capacity = 5 };
        needsAi.MinPerMajor.Add("AI", 1);
        var request = new SuggestRoomsRequest { Student = new Student { StudentId = "s", MajorCode = "AI" }, Top = 2 };
        request.Rooms.Add(new Room { RoomId = "full", Name = "B", Capacity = 0 });
        request.Rooms.Add(needsAi);

        var reply = await Client.SuggestRoomsAsync(request, cancellationToken: Ct);

        var suggestion = Assert.Single(reply.Suggestions);
        Assert.Equal("needs-ai", suggestion.RoomId);
        Assert.Equal(3.0, suggestion.Score);
        var reason = Assert.Single(suggestion.Reasons);
        Assert.Equal(("MAJOR_NEEDED", "AI"), (reason.Code, reason.Detail));
    }

    [Fact]
    public async Task Placements_come_back_over_grpc_with_the_unplaced_students()
    {
        var request = new SuggestPlacementsRequest();
        request.Rooms.Add(new Room { RoomId = "r", Name = "A", Capacity = 1 });
        request.Unassigned.Add(new Student { StudentId = "s1", MajorCode = "SE" });
        request.Unassigned.Add(new Student { StudentId = "s2", MajorCode = "SE" });

        var reply = await Client.SuggestPlacementsAsync(request, cancellationToken: Ct);

        var placement = Assert.Single(reply.Placements);
        Assert.Equal(("s1", "r"), (placement.StudentId, placement.RoomId));
        Assert.Equal(new[] { "s2" }, reply.UnplacedStudentIds);
    }

    [Fact]
    public async Task A_room_request_without_a_student_is_an_invalid_argument()
    {
        var error = await Assert.ThrowsAsync<RpcException>(async () => await Client.SuggestRoomsAsync(new SuggestRoomsRequest(), cancellationToken: Ct));

        Assert.Equal(StatusCode.InvalidArgument, error.StatusCode);
    }
}
