using ExeGroup.Contracts.Recommendation;
using ExeGroup.Recommendation.Services.Suggestions;
using Grpc.Core;
using RecommendationContract = ExeGroup.Contracts.Recommendation.Recommendation;

namespace ExeGroup.Recommendation.API.Grpc;

public sealed class RecommendationGrpcService(IRecommendationService recommendations, ILogger<RecommendationGrpcService> logger)
    : RecommendationContract.RecommendationBase
{
    public override Task<SuggestRoomsReply> SuggestRooms(SuggestRoomsRequest request, ServerCallContext context)
    {
        if (request.Student is null)
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "A student is required to suggest rooms."));
        }

        List<RoomProfile> rooms = [.. request.Rooms.Select(room => room.ToProfile())];
        var suggestions = recommendations.SuggestRooms(request.Student.ToProfile(), rooms, request.Top);
        logger.LogInformation(
            "Suggested {Suggested} of {Rooms} rooms to student {StudentId}",
            suggestions.Count,
            rooms.Count,
            request.Student.StudentId);
        return Task.FromResult(suggestions.ToReply());
    }

    public override Task<SuggestPlacementsReply> SuggestPlacements(SuggestPlacementsRequest request, ServerCallContext context)
    {
        List<RoomProfile> rooms = [.. request.Rooms.Select(room => room.ToProfile())];
        List<StudentProfile> unassigned = [.. request.Unassigned.Select(student => student.ToProfile())];
        var plan = recommendations.SuggestPlacements(unassigned, rooms);
        logger.LogInformation(
            "Placed {Placed} of {Students} students in {Rooms} rooms; {Unplaced} fit nowhere",
            plan.Placements.Count,
            unassigned.Count,
            rooms.Count,
            plan.UnplacedStudentIds.Count);
        return Task.FromResult(plan.ToReply());
    }
}
