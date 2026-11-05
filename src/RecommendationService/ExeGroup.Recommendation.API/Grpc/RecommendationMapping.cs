using ExeGroup.Recommendation.Services.Suggestions;
using Contract = ExeGroup.Contracts.Recommendation;

namespace ExeGroup.Recommendation.API.Grpc;

internal static class RecommendationMapping
{
    public static StudentProfile ToProfile(this Contract.Student student) =>
        new(student.StudentId, student.MajorCode, new Dictionary<string, int>(student.Skills));

    public static RoomProfile ToProfile(this Contract.Room room) =>
        new(
            room.RoomId,
            room.Name,
            room.Capacity,
            [.. room.Members.Select(member => member.ToProfile())],
            new Dictionary<string, int>(room.MinPerMajor),
            room.MinDistinctMajors,
            room.MinGroupSize);

    public static Contract.SuggestRoomsReply ToReply(this IReadOnlyList<RoomSuggestion> suggestions)
    {
        var reply = new Contract.SuggestRoomsReply();
        foreach (var suggestion in suggestions)
        {
            var item = new Contract.RoomSuggestion { RoomId = suggestion.RoomId, Score = suggestion.Score };
            item.Reasons.Add(suggestion.Reasons.Select(ToContract));
            reply.Suggestions.Add(item);
        }

        return reply;
    }

    public static Contract.SuggestPlacementsReply ToReply(this PlacementPlan plan)
    {
        var reply = new Contract.SuggestPlacementsReply();
        foreach (var placement in plan.Placements)
        {
            var item = new Contract.Placement { StudentId = placement.StudentId, RoomId = placement.RoomId };
            item.Reasons.Add(placement.Reasons.Select(ToContract));
            reply.Placements.Add(item);
        }

        reply.UnplacedStudentIds.Add(plan.UnplacedStudentIds);
        return reply;
    }

    private static Contract.Reason ToContract(SuggestionReason reason) => new() { Code = reason.Code, Detail = reason.Detail };
}
