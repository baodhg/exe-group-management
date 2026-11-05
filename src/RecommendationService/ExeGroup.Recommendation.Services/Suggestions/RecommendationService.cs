namespace ExeGroup.Recommendation.Services.Suggestions;

public interface IRecommendationService
{
    IReadOnlyList<RoomSuggestion> SuggestRooms(StudentProfile student, IReadOnlyList<RoomProfile> rooms, int top);

    PlacementPlan SuggestPlacements(IReadOnlyList<StudentProfile> unassigned, IReadOnlyList<RoomProfile> rooms);
}

public sealed class RecommendationService : IRecommendationService
{
    public const int DefaultTop = 3;
    public const double MajorNeededPoints = 3;
    public const double BelowMinimumPoints = 2;
    public const double PointsPerSkillLevel = 0.2;

    public IReadOnlyList<RoomSuggestion> SuggestRooms(StudentProfile student, IReadOnlyList<RoomProfile> rooms, int top) =>
        [.. Rank(student, [.. rooms.Select(room => new RoomState(room))])
            .Take(top > 0 ? top : DefaultTop)
            .Select(candidate => candidate.Suggestion)];

    public PlacementPlan SuggestPlacements(IReadOnlyList<StudentProfile> unassigned, IReadOnlyList<RoomProfile> rooms)
    {
        List<RoomState> states = [.. rooms.Select(room => new RoomState(room))];
        var placements = new List<PlacementSuggestion>();
        var unplaced = new List<string>();
        foreach (var student in ScarcestMajorsFirst([.. unassigned.DistinctBy(candidate => candidate.StudentId)], states))
        {
            var best = Rank(student, states).FirstOrDefault();
            if (best is null)
            {
                unplaced.Add(student.StudentId);
                continue;
            }

            best.Room.Add(student);
            placements.Add(new PlacementSuggestion(student.StudentId, best.Room.RoomId, best.Suggestion.Reasons));
        }

        return new PlacementPlan(placements, unplaced);
    }

    private static IEnumerable<Candidate> Rank(StudentProfile student, List<RoomState> rooms) =>
        rooms
            .Where(room => room.Accepts(student))
            .Select(room => new Candidate(room, Score(student, room)))
            .OrderByDescending(candidate => candidate.Suggestion.Score)
            .ThenBy(candidate => candidate.Room.MemberCount)
            .ThenBy(candidate => candidate.Room.RoomId, StringComparer.Ordinal);

    private static RoomSuggestion Score(StudentProfile student, RoomState room)
    {
        var reasons = new List<SuggestionReason>();
        var score = 0.0;
        if (room.NeedsMajorOf(student))
        {
            score += MajorNeededPoints;
            reasons.Add(new SuggestionReason(ReasonCodes.MajorNeeded, student.MajorCode));
        }

        foreach (var (skill, gap) in room.SkillGapsOf(student))
        {
            score += gap * PointsPerSkillLevel;
            reasons.Add(new SuggestionReason(ReasonCodes.SkillGap, skill));
        }

        if (room.IsBelowMinimum)
        {
            score += BelowMinimumPoints;
            reasons.Add(new SuggestionReason(ReasonCodes.BelowMinimum, $"{room.MemberCount}/{room.MinGroupSize}"));
        }

        return new RoomSuggestion(room.RoomId, Math.Round(score, 2), reasons);
    }

    private static List<StudentProfile> ScarcestMajorsFirst(List<StudentProfile> students, List<RoomState> rooms)
    {
        var supply = students.CountBy(student => student.MajorCode).ToDictionary(pair => pair.Key, pair => pair.Value);
        var demand = supply.Keys.ToDictionary(major => major, major => rooms.Sum(room => room.MissingSeatsFor(major)));
        return
        [
            .. students
                .OrderBy(student => supply[student.MajorCode] - demand[student.MajorCode])
                .ThenBy(student => supply[student.MajorCode])
                .ThenBy(student => student.StudentId, StringComparer.Ordinal),
        ];
    }

    private sealed record Candidate(RoomState Room, RoomSuggestion Suggestion);
}
