using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Contracts.Recommendation;
using Grpc.Core;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using RecommendationContract = ExeGroup.Contracts.Recommendation.Recommendation;

namespace ExeGroup.Group.IntegrationTests;

public enum FakeRecommendationMode
{
    Rank,
    Fail,
    Hang,
}

public sealed class FakeRecommendationState
{
    public FakeRecommendationMode Mode { get; set; } = FakeRecommendationMode.Rank;

    public SuggestRoomsRequest? RoomsRequest { get; set; }

    public SuggestPlacementsRequest? PlacementsRequest { get; set; }

    public string? CorrelationId { get; set; }
}

public sealed class FakeRecommendationServer : IAsyncDisposable
{
    private readonly WebApplication _app;

    private FakeRecommendationServer(WebApplication app, FakeRecommendationState state)
    {
        _app = app;
        State = state;
    }

    public FakeRecommendationState State { get; }

    public static async Task<FakeRecommendationServer> StartAsync()
    {
        var state = new FakeRecommendationState();
        var builder = WebApplication.CreateSlimBuilder();
        builder.WebHost.UseTestServer();
        builder.Services.AddGrpc();
        builder.Services.AddSingleton(state);
        var app = builder.Build();
        app.MapGrpcService<FakeRecommendationService>();
        await app.StartAsync();
        return new FakeRecommendationServer(app, state);
    }

    public HttpMessageHandler CreateHandler() => _app.GetTestServer().CreateHandler();

    public ValueTask DisposeAsync() => _app.DisposeAsync();

    private sealed class FakeRecommendationService(FakeRecommendationState state) : RecommendationContract.RecommendationBase
    {
        public override async Task<SuggestRoomsReply> SuggestRooms(SuggestRoomsRequest request, ServerCallContext context)
        {
            state.RoomsRequest = request;
            await BehaveAsync(context);
            var reply = new SuggestRoomsReply();
            var ranked = request.Rooms.OrderByDescending(room => room.Name, StringComparer.Ordinal).Take(request.Top).ToList();
            for (var index = 0; index < ranked.Count; index++)
            {
                var suggestion = new RoomSuggestion { RoomId = ranked[index].RoomId, Score = 10 - index };
                suggestion.Reasons.Add(new Reason { Code = "MAJOR_NEEDED", Detail = request.Student.MajorCode });
                reply.Suggestions.Add(suggestion);
            }

            return reply;
        }

        public override async Task<SuggestPlacementsReply> SuggestPlacements(SuggestPlacementsRequest request, ServerCallContext context)
        {
            state.PlacementsRequest = request;
            await BehaveAsync(context);
            var reply = new SuggestPlacementsReply();
            var room = request.Rooms.OrderBy(item => item.Name, StringComparer.Ordinal).First();
            var placement = new Placement { StudentId = request.Unassigned[0].StudentId, RoomId = room.RoomId };
            placement.Reasons.Add(new Reason { Code = "BELOW_MINIMUM", Detail = $"{room.Members.Count}/{room.MinGroupSize}" });
            reply.Placements.Add(placement);
            reply.UnplacedStudentIds.Add(request.Unassigned.Skip(1).Select(student => student.StudentId));
            return reply;
        }

        private async Task BehaveAsync(ServerCallContext context)
        {
            state.CorrelationId = context.RequestHeaders.GetValue(CorrelationContext.MetadataKey);
            switch (state.Mode)
            {
                case FakeRecommendationMode.Fail:
                    throw new RpcException(new Status(StatusCode.Unavailable, "The recommendation service is down."));
                case FakeRecommendationMode.Hang:
                    try
                    {
                        await Task.Delay(TimeSpan.FromSeconds(10), context.CancellationToken);
                    }
                    catch (OperationCanceledException)
                    {
                        throw new RpcException(new Status(StatusCode.Cancelled, "The caller gave up."));
                    }

                    break;
            }
        }
    }
}
