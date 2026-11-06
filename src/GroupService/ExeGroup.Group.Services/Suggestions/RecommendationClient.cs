using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Grpc;
using Grpc.Core;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Contract = ExeGroup.Contracts.Recommendation;

namespace ExeGroup.Group.Services.Suggestions;

public sealed record SuggestionStudent(Guid StudentId, string MajorCode, IReadOnlyDictionary<string, int> Skills);

public sealed record SuggestionRoom(
    Guid RoomId,
    string Name,
    int Capacity,
    IReadOnlyList<SuggestionStudent> Members,
    IReadOnlyDictionary<string, int> MinPerMajor,
    int MinDistinctMajors,
    int MinGroupSize);

public sealed record SuggestionReasonModel(string Code, string Detail);

public sealed record RankedRoom(Guid RoomId, double Score, IReadOnlyList<SuggestionReasonModel> Reasons);

public sealed record SuggestedPlacement(Guid StudentId, Guid RoomId, IReadOnlyList<SuggestionReasonModel> Reasons);

public sealed record PlacementPlan(IReadOnlyList<SuggestedPlacement> Placements, IReadOnlyList<Guid> UnplacedStudentIds);

public interface IRecommendationClient
{
    Task<IReadOnlyList<RankedRoom>?> SuggestRoomsAsync(SuggestionStudent student, IReadOnlyList<SuggestionRoom> rooms, int top, CancellationToken cancellationToken);

    Task<PlacementPlan?> SuggestPlacementsAsync(IReadOnlyList<SuggestionStudent> unassigned, IReadOnlyList<SuggestionRoom> rooms, CancellationToken cancellationToken);
}

public sealed class RecommendationClient(Contract.Recommendation.RecommendationClient client, ILogger<RecommendationClient> logger) : IRecommendationClient
{
    public const string AddressKey = "Recommendation:Address";
    public const string DefaultAddress = "http://recommendation-service:8081";
    public static readonly TimeSpan Deadline = TimeSpan.FromSeconds(2);

    public static void Register(IServiceCollection services, IConfiguration configuration)
    {
        services.AddGrpcClient<Contract.Recommendation.RecommendationClient>(options => options.Address = new Uri(configuration[AddressKey] ?? DefaultAddress))
            .AddInterceptor(provider => new CorrelationClientInterceptor(provider.GetRequiredService<ICorrelationContext>()))
            .AddInterceptor(() => new DefaultDeadlineClientInterceptor(Deadline));
        services.AddScoped<IRecommendationClient, RecommendationClient>();
    }

    public async Task<IReadOnlyList<RankedRoom>?> SuggestRoomsAsync(
        SuggestionStudent student,
        IReadOnlyList<SuggestionRoom> rooms,
        int top,
        CancellationToken cancellationToken)
    {
        var request = new Contract.SuggestRoomsRequest { Student = ToContract(student), Top = top };
        request.Rooms.Add(rooms.Select(ToContract));
        try
        {
            var reply = await client.SuggestRoomsAsync(request, cancellationToken: cancellationToken);
            return reply.Suggestions
                .Where(suggestion => Guid.TryParse(suggestion.RoomId, out _))
                .Select(suggestion => new RankedRoom(Guid.Parse(suggestion.RoomId), suggestion.Score, ToModels(suggestion.Reasons)))
                .ToList();
        }
        catch (RpcException error) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(error, "SuggestRooms failed with {StatusCode}; returning rooms without ranking", error.StatusCode);
            return null;
        }
    }

    public async Task<PlacementPlan?> SuggestPlacementsAsync(
        IReadOnlyList<SuggestionStudent> unassigned,
        IReadOnlyList<SuggestionRoom> rooms,
        CancellationToken cancellationToken)
    {
        var request = new Contract.SuggestPlacementsRequest();
        request.Unassigned.Add(unassigned.Select(ToContract));
        request.Rooms.Add(rooms.Select(ToContract));
        try
        {
            var reply = await client.SuggestPlacementsAsync(request, cancellationToken: cancellationToken);
            return new PlacementPlan(
                reply.Placements
                    .Where(placement => Guid.TryParse(placement.StudentId, out _) && Guid.TryParse(placement.RoomId, out _))
                    .Select(placement => new SuggestedPlacement(Guid.Parse(placement.StudentId), Guid.Parse(placement.RoomId), ToModels(placement.Reasons)))
                    .ToList(),
                reply.UnplacedStudentIds.Where(id => Guid.TryParse(id, out _)).Select(Guid.Parse).ToList());
        }
        catch (RpcException error) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(error, "SuggestPlacements failed with {StatusCode}; returning students without suggestions", error.StatusCode);
            return null;
        }
    }

    private static Contract.Student ToContract(SuggestionStudent student)
    {
        var contract = new Contract.Student { StudentId = student.StudentId.ToString(), MajorCode = student.MajorCode };
        contract.Skills.Add(student.Skills.ToDictionary());
        return contract;
    }

    private static Contract.Room ToContract(SuggestionRoom room)
    {
        var contract = new Contract.Room
        {
            RoomId = room.RoomId.ToString(),
            Name = room.Name,
            Capacity = room.Capacity,
            MinDistinctMajors = room.MinDistinctMajors,
            MinGroupSize = room.MinGroupSize,
        };
        contract.Members.Add(room.Members.Select(ToContract));
        contract.MinPerMajor.Add(room.MinPerMajor.ToDictionary());
        return contract;
    }

    private static List<SuggestionReasonModel> ToModels(IEnumerable<Contract.Reason> reasons) =>
        reasons.Select(reason => new SuggestionReasonModel(reason.Code, reason.Detail)).ToList();
}
