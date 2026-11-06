using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using ExeGroup.Group.Services.Rooms;

namespace ExeGroup.Group.Services.Suggestions;

public sealed record SuggestedRoomModel(RoomSummaryModel Room, double? Score, IReadOnlyList<SuggestionReasonModel> Reasons);

public sealed record RoomSuggestionsModel(bool Ranked, IReadOnlyList<SuggestedRoomModel> Rooms);

public sealed record StudentRefModel(Guid StudentId, string StudentCode, string FullName, string MajorCode);

public sealed record PlacementModel(StudentRefModel Student, Guid RoomId, string RoomName, IReadOnlyList<SuggestionReasonModel> Reasons);

public sealed record PlacementSuggestionsModel(
    bool Ranked,
    IReadOnlyList<PlacementModel> Placements,
    IReadOnlyList<StudentRefModel> Unplaced,
    IReadOnlyList<RoomSummaryModel> Rooms);

public interface ISuggestionService
{
    Task<RoomSuggestionsModel> SuggestRoomsAsync(Guid courseId, int top, CancellationToken cancellationToken);

    Task<PlacementSuggestionsModel> SuggestPlacementsAsync(Guid courseId, CancellationToken cancellationToken);
}

public sealed class SuggestionService(IRoomRepository rooms, RoomSummaries summaries, IRecommendationClient recommendations, ICurrentUser currentUser) : ISuggestionService
{
    public const int MaxTop = 20;

    public async Task<RoomSuggestionsModel> SuggestRoomsAsync(Guid courseId, int top, CancellationToken cancellationToken)
    {
        if (top is < 1 or > MaxTop)
        {
            throw new ValidationFailedException("top", $"Ask for 1 to {MaxTop} rooms.");
        }

        var course = await rooms.FindCourseAsync(courseId, cancellationToken) ?? throw new NotFoundException("Course", courseId);
        RoomSeating.EnsurePublished(course);
        var studentId = currentUser.RequireUserId();
        var students = await rooms.ListCourseStudentsAsync(course, cancellationToken);
        var me = students.SingleOrDefault(student => student.StudentId == studentId)
            ?? throw RoomSeating.Conflict(GroupErrorCodes.NotEnrolled, "You are not on the course roster.");
        var removedFrom = await rooms.ListRoomsRemovedFromAsync(courseId, studentId, cancellationToken);
        var candidates = (await rooms.ListRowsWithSeatAsync(courseId, cancellationToken))
            .Where(row => row.Room.RoomId != me.RoomId && !removedFrom.Contains(row.Room.RoomId))
            .ToList();
        var board = await BoardAsync(course, candidates, students, cancellationToken);

        var ranked = await recommendations.SuggestRoomsAsync(ToStudent(me), board.Rooms, top, cancellationToken);
        var cards = (await summaries.BuildAsync(candidates, cancellationToken)).ToDictionary(card => card.Id);
        if (ranked is not null)
        {
            return new RoomSuggestionsModel(
                true,
                ranked
                    .Where(room => cards.ContainsKey(room.RoomId))
                    .Select(room => new SuggestedRoomModel(cards[room.RoomId], room.Score, room.Reasons))
                    .ToList());
        }

        return new RoomSuggestionsModel(
            false,
            candidates
                .Where(row => RoomComposition.CanAdd(row.Room.Capacity, board.MemberMajors(row.Room.RoomId), me.MajorId, board.Rules[row.Room.GroupTypeId]))
                .Select(row => new SuggestedRoomModel(cards[row.Room.RoomId], null, []))
                .ToList());
    }

    public async Task<PlacementSuggestionsModel> SuggestPlacementsAsync(Guid courseId, CancellationToken cancellationToken)
    {
        var course = await rooms.FindCourseAsync(courseId, cancellationToken) ?? throw new NotFoundException("Course", courseId);
        if (course.Phase != CoursePhases.Expired)
        {
            throw RoomSeating.Conflict(GroupErrorCodes.CourseNotExpired, "Placements are suggested only after the course expired.");
        }

        var students = await rooms.ListCourseStudentsAsync(course, cancellationToken);
        var unassigned = students.Where(student => student.RoomId is null).ToList();
        var candidates = await rooms.ListRowsWithSeatAsync(courseId, cancellationToken);
        var board = await BoardAsync(course, candidates, students, cancellationToken);
        var summaries = candidates.Select(RoomService.ToSummary).ToList();
        var refs = unassigned.ToDictionary(student => student.StudentId, ToRef);

        var plan = unassigned.Count == 0 || candidates.Count == 0
            ? new PlacementPlan([], [.. unassigned.Select(student => student.StudentId)])
            : await recommendations.SuggestPlacementsAsync([.. unassigned.Select(ToStudent)], board.Rooms, cancellationToken);
        if (plan is null)
        {
            return new PlacementSuggestionsModel(false, [], [.. refs.Values], summaries);
        }

        var names = candidates.ToDictionary(row => row.Room.RoomId, row => row.Room.Name);
        var placements = plan.Placements
            .Where(placement => refs.ContainsKey(placement.StudentId) && names.ContainsKey(placement.RoomId))
            .Select(placement => new PlacementModel(refs[placement.StudentId], placement.RoomId, names[placement.RoomId], placement.Reasons))
            .ToList();
        var placed = placements.Select(placement => placement.Student.StudentId).ToHashSet();
        return new PlacementSuggestionsModel(true, placements, [.. refs.Values.Where(student => !placed.Contains(student.StudentId))], summaries);
    }

    private async Task<Board> BoardAsync(Course course, List<RoomRow> candidates, List<CourseStudentProfile> students, CancellationToken cancellationToken)
    {
        var rules = new Dictionary<Guid, GroupTypeRules>();
        foreach (var groupTypeId in candidates.Select(row => row.Room.GroupTypeId).Distinct())
        {
            rules[groupTypeId] = await rooms.GetRulesAsync(groupTypeId, cancellationToken);
        }

        var members = students.Where(student => student.RoomId is not null).ToLookup(student => student.RoomId!.Value);
        var suggestionRooms = candidates
            .Select(row =>
            {
                var rule = rules[row.Room.GroupTypeId];
                return new SuggestionRoom(
                    row.Room.RoomId,
                    row.Room.Name,
                    row.Room.Capacity,
                    [.. members[row.Room.RoomId].Select(ToStudent)],
                    rule.MinPerMajor.Where(pair => rule.MajorCodes.ContainsKey(pair.Key)).ToDictionary(pair => rule.MajorCodes[pair.Key], pair => pair.Value),
                    rule.MinDistinctMajors,
                    course.MinGroupSize);
            })
            .ToList();
        return new Board(suggestionRooms, rules, members);
    }

    private static SuggestionStudent ToStudent(CourseStudentProfile student) => new(student.StudentId, student.MajorCode, student.Skills);

    private static StudentRefModel ToRef(CourseStudentProfile student) => new(student.StudentId, student.StudentCode, student.FullName, student.MajorCode);

    private sealed record Board(List<SuggestionRoom> Rooms, Dictionary<Guid, GroupTypeRules> Rules, ILookup<Guid, CourseStudentProfile> Members)
    {
        public List<Guid> MemberMajors(Guid roomId) => [.. Members[roomId].Select(member => member.MajorId)];
    }
}
