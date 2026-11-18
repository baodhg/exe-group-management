using ExeGroup.Group.Repositories.Interfaces;
using ExeGroup.Group.Services.Rooms;

namespace ExeGroup.Group.Tests;

public sealed class RoomCompositionTests
{
    private static readonly Guid Se = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Mkt = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid Gd = Guid.Parse("33333333-3333-3333-3333-333333333333");

    private static GroupTypeRules Rules(int minDistinctMajors, params (Guid Major, int MinMembers)[] perMajor) =>
        new(
            Guid.Parse("44444444-4444-4444-4444-444444444444"),
            "EXE",
            "EXE startup team",
            minDistinctMajors,
            perMajor.ToDictionary(item => item.Major, item => item.MinMembers),
            perMajor.ToDictionary(item => item.Major, item => item.Major == Se ? "SE" : "MKT"));

    [Fact]
    public void An_empty_room_needs_one_seat_for_every_required_major()
    {
        var rules = Rules(2, (Se, 1), (Mkt, 1));

        Assert.Equal(2, RoomComposition.SeatsStillNeeded([], rules));
    }

    [Fact]
    public void A_major_that_asks_for_two_members_needs_two_seats()
    {
        var rules = Rules(1, (Se, 2));

        Assert.Equal(2, RoomComposition.SeatsStillNeeded([], rules));
        Assert.Equal(1, RoomComposition.SeatsStillNeeded([Se], rules));
        Assert.Equal(0, RoomComposition.SeatsStillNeeded([Se, Se], rules));
    }

    [Fact]
    public void Surplus_members_of_one_major_do_not_cover_another_major()
    {
        var rules = Rules(2, (Se, 1), (Mkt, 1));

        Assert.Equal(1, RoomComposition.SeatsStillNeeded([Se, Se, Se], rules));
    }

    [Fact]
    public void The_distinct_major_rule_asks_for_extra_members()
    {
        var rules = Rules(3);

        Assert.Equal(3, RoomComposition.SeatsStillNeeded([], rules));
        Assert.Equal(2, RoomComposition.SeatsStillNeeded([Se], rules));
        Assert.Equal(0, RoomComposition.SeatsStillNeeded([Se, Mkt, Gd], rules));
    }

    [Fact]
    public void A_required_major_counts_towards_the_distinct_major_rule()
    {
        var rules = Rules(2, (Se, 1));

        Assert.Equal(1, RoomComposition.SeatsStillNeeded([Mkt], rules));
    }

    [Fact]
    public void A_room_is_eligible_only_when_it_is_full_enough_and_complete()
    {
        var rules = Rules(2, (Se, 1), (Mkt, 1));

        Assert.False(RoomComposition.IsEligible(2, [Se, Se], rules));
        Assert.False(RoomComposition.IsEligible(3, [Se, Mkt], rules));
        Assert.True(RoomComposition.IsEligible(2, [Se, Mkt], rules));
    }

    [Fact]
    public void A_member_can_be_added_only_when_the_room_keeps_room_for_the_missing_majors()
    {
        var rules = Rules(2, (Se, 1), (Mkt, 1));

        Assert.True(RoomComposition.CanAdd(4, [Se], Mkt, rules));
        Assert.True(RoomComposition.CanAdd(4, [Se], Gd, rules));
        Assert.False(RoomComposition.CanAdd(2, [Se], Gd, rules));
        Assert.True(RoomComposition.CanAdd(2, [Se], Mkt, rules));
    }

    [Fact]
    public void A_full_room_refuses_every_new_member()
    {
        var rules = Rules(2, (Se, 1), (Mkt, 1));

        Assert.False(RoomComposition.CanAdd(4, [Se, Se, Se, Se], Mkt, rules));
    }

    [Fact]
    public void A_room_that_cannot_hold_the_requirements_is_not_feasible()
    {
        var rules = Rules(3);

        var failure = Assert.Throws<ExeGroup.BuildingBlocks.Errors.ValidationFailedException>(() => RoomComposition.EnsureFeasible(2, rules));

        Assert.Equal("groupTypeId", failure.Errors[0].Field);
    }

    [Fact]
    public void A_room_that_can_hold_the_requirements_is_feasible()
    {
        RoomComposition.EnsureFeasible(3, Rules(3));

        Assert.True(true);
    }
}
