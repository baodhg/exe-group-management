using ExeGroup.Recommendation.Services.Suggestions;
using static ExeGroup.Recommendation.Tests.Build;

namespace ExeGroup.Recommendation.Tests;

public sealed class RoomSuggestionTests
{
    private readonly RecommendationService _service = new();

    [Fact]
    public void A_full_room_is_never_suggested()
    {
        var full = Room("full", capacity: 2, members: [Student("a", "SE"), Student("b", "SE")]);

        var suggestions = _service.SuggestRooms(Student("s", "SE"), [full, Room("open", capacity: 2)], top: 5);

        Assert.Equal(new[] { "open" }, suggestions.Select(suggestion => suggestion.RoomId));
    }

    [Fact]
    public void A_room_the_join_would_lock_out_of_a_required_major_is_dropped()
    {
        var room = Room("r", capacity: 4, members: [Student("a", "SE"), Student("b", "SE")], minPerMajor: AtLeast("AI", 2));

        Assert.Empty(_service.SuggestRooms(Student("s", "SE"), [room], top: 5));
        Assert.Single(_service.SuggestRooms(Student("s", "AI"), [room], top: 5));
    }

    [Fact]
    public void A_room_that_still_needs_the_major_ranks_first_and_says_why()
    {
        var needsAi = Room("needs-ai", members: [Student("a", "SE")], minPerMajor: AtLeast("AI", 1));
        var other = Room("other", members: [Student("b", "SE")]);

        var suggestions = _service.SuggestRooms(Student("s", "AI"), [other, needsAi], top: 5);

        Assert.Equal(new[] { "needs-ai", "other" }, suggestions.Select(suggestion => suggestion.RoomId));
        Assert.Equal(new SuggestionReason(ReasonCodes.MajorNeeded, "AI"), Assert.Single(suggestions[0].Reasons));
        Assert.Equal(RecommendationService.MajorNeededPoints, suggestions[0].Score);
        Assert.Empty(suggestions[1].Reasons);
    }

    [Fact]
    public void A_new_major_is_needed_only_while_the_room_lacks_distinct_majors()
    {
        var room = Room("r", members: [Student("a", "SE"), Student("b", "SE")], minDistinctMajors: 2);

        var newMajor = _service.SuggestRooms(Student("s", "GD"), [room], top: 1).Single();
        var sameMajor = _service.SuggestRooms(Student("t", "SE"), [room], top: 1).Single();

        Assert.Contains(new SuggestionReason(ReasonCodes.MajorNeeded, "GD"), newMajor.Reasons);
        Assert.DoesNotContain(sameMajor.Reasons, reason => reason.Code == ReasonCodes.MajorNeeded);
    }

    [Fact]
    public void A_major_the_rules_will_bring_anyway_is_not_needed_for_variety()
    {
        var room = Room("r", members: [Student("a", "AI")], minPerMajor: AtLeast("SE", 1), minDistinctMajors: 2);

        var suggestion = _service.SuggestRooms(Student("s", "GD"), [room], top: 1).Single();

        Assert.DoesNotContain(suggestion.Reasons, reason => reason.Code == ReasonCodes.MajorNeeded);
    }

    [Fact]
    public void Skill_gaps_name_each_skill_the_student_brings_above_the_room()
    {
        var room = Room("r", members: [Student("a", "SE", ("backend", 4), ("design", 1))]);
        var student = Student("s", "SE", ("backend", 3), ("design", 4), ("testing", 2));

        var suggestion = _service.SuggestRooms(student, [room], top: 1).Single();

        SuggestionReason[] expected = [new(ReasonCodes.SkillGap, "design"), new(ReasonCodes.SkillGap, "testing")];
        Assert.Equal(expected, suggestion.Reasons);
        Assert.Equal(1.0, suggestion.Score);
    }

    [Fact]
    public void A_room_below_the_minimum_size_is_preferred_and_marked()
    {
        var small = Room("small", members: [Student("a", "SE")], minGroupSize: 3);
        var settled = Room("settled", members: [Student("b", "SE"), Student("c", "SE"), Student("d", "SE")], minGroupSize: 3);

        var suggestions = _service.SuggestRooms(Student("s", "SE"), [settled, small], top: 5);

        Assert.Equal(new[] { "small", "settled" }, suggestions.Select(suggestion => suggestion.RoomId));
        Assert.Equal(new SuggestionReason(ReasonCodes.BelowMinimum, "1/3"), Assert.Single(suggestions[0].Reasons));
    }

    [Fact]
    public void Top_limits_the_list_defaults_to_three_and_ties_prefer_smaller_rooms()
    {
        RoomProfile[] rooms =
        [
            Room("d", members: [Student("d1", "SE"), Student("d2", "SE")]),
            Room("c", members: [Student("c1", "SE")]),
            Room("b"),
            Room("a"),
        ];

        Assert.Equal(new[] { "a", "b", "c" }, _service.SuggestRooms(Student("s", "SE"), rooms, top: 0).Select(suggestion => suggestion.RoomId));
        Assert.Equal(new[] { "a" }, _service.SuggestRooms(Student("s", "SE"), rooms, top: 1).Select(suggestion => suggestion.RoomId));
    }

    [Fact]
    public void The_room_the_student_is_already_in_is_not_suggested()
    {
        Assert.Empty(_service.SuggestRooms(Student("s", "SE"), [Room("own", members: [Student("s", "SE")])], top: 5));
    }
}
