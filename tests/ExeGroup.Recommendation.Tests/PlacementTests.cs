using ExeGroup.Recommendation.Services.Suggestions;
using static ExeGroup.Recommendation.Tests.Build;

namespace ExeGroup.Recommendation.Tests;

public sealed class PlacementTests
{
    private readonly RecommendationService _service = new();

    [Fact]
    public void Students_of_the_scarcest_major_are_placed_first()
    {
        RoomProfile[] rooms = [Room("r1", capacity: 3, minPerMajor: AtLeast("AI", 1)), Room("r2", capacity: 3, minPerMajor: AtLeast("AI", 1))];

        var plan = _service.SuggestPlacements([Student("se1", "SE"), Student("se2", "SE"), Student("ai1", "AI")], rooms);

        Assert.Equal("ai1", plan.Placements[0].StudentId);
        Assert.Contains(new SuggestionReason(ReasonCodes.MajorNeeded, "AI"), plan.Placements[0].Reasons);
        Assert.Equal(3, plan.Placements.Count);
        Assert.Empty(plan.UnplacedStudentIds);
    }

    [Fact]
    public void Seats_kept_for_a_missing_major_leave_the_others_unplaced()
    {
        var plan = _service.SuggestPlacements([Student("se1", "SE"), Student("se2", "SE")], [Room("r", capacity: 2, minPerMajor: AtLeast("AI", 1))]);

        Assert.Equal("se1", Assert.Single(plan.Placements).StudentId);
        Assert.Equal(new[] { "se2" }, plan.UnplacedStudentIds);
    }

    [Fact]
    public void A_full_room_receives_no_one()
    {
        var plan = _service.SuggestPlacements([Student("s", "SE")], [Room("full", capacity: 1, members: [Student("a", "SE")])]);

        Assert.Empty(plan.Placements);
        Assert.Equal(new[] { "s" }, plan.UnplacedStudentIds);
    }

    [Fact]
    public void Each_placement_fills_the_room_the_next_student_sees()
    {
        var plan = _service.SuggestPlacements(
            [Student("s1", "SE"), Student("s2", "SE"), Student("s3", "SE")],
            [Room("a", capacity: 1), Room("b", capacity: 1)]);

        Assert.Equal(new[] { ("s1", "a"), ("s2", "b") }, plan.Placements.Select(placement => (placement.StudentId, placement.RoomId)));
        Assert.Equal(new[] { "s3" }, plan.UnplacedStudentIds);
    }

    [Fact]
    public void A_student_listed_twice_is_placed_once()
    {
        var plan = _service.SuggestPlacements([Student("s", "SE"), Student("s", "SE")], [Room("a", capacity: 2)]);

        Assert.Equal("s", Assert.Single(plan.Placements).StudentId);
        Assert.Empty(plan.UnplacedStudentIds);
    }
}
