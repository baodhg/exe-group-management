namespace ExeGroup.Recommendation.Services.Suggestions;

public sealed record StudentProfile(string StudentId, string MajorCode, IReadOnlyDictionary<string, int> Skills);

public sealed record RoomProfile(
    string RoomId,
    string Name,
    int Capacity,
    IReadOnlyList<StudentProfile> Members,
    IReadOnlyDictionary<string, int> MinPerMajor,
    int MinDistinctMajors,
    int MinGroupSize);

public sealed record SuggestionReason(string Code, string Detail);

public sealed record RoomSuggestion(string RoomId, double Score, IReadOnlyList<SuggestionReason> Reasons);

public sealed record PlacementSuggestion(string StudentId, string RoomId, IReadOnlyList<SuggestionReason> Reasons);

public sealed record PlacementPlan(IReadOnlyList<PlacementSuggestion> Placements, IReadOnlyList<string> UnplacedStudentIds);

public static class ReasonCodes
{
    public const string MajorNeeded = "MAJOR_NEEDED";
    public const string SkillGap = "SKILL_GAP";
    public const string BelowMinimum = "BELOW_MINIMUM";
}
