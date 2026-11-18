using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Services.Rooms;

namespace ExeGroup.Group.Tests;

public sealed class RequestCloserStatusTests
{
    [Fact]
    public void A_student_pull_cancels_the_application()
    {
        Assert.Equal(JoinRequestStatuses.Cancelled, RequestCloser.StatusFor(JoinRequestReasons.Withdrawn));
    }

    [Fact]
    public void A_student_who_joined_another_room_cancels_the_application()
    {
        Assert.Equal(JoinRequestStatuses.Cancelled, RequestCloser.StatusFor(JoinRequestReasons.JoinedAnotherRoom));
    }

    [Fact]
    public void A_reopened_room_cancels_the_application()
    {
        Assert.Equal(JoinRequestStatuses.Cancelled, RequestCloser.StatusFor(JoinRequestReasons.RoomReopened));
    }

    [Fact]
    public void A_leader_refusal_rejects_the_application()
    {
        Assert.Equal(JoinRequestStatuses.Rejected, RequestCloser.StatusFor(JoinRequestReasons.RejectedByLeader));
    }

    [Fact]
    public void A_full_room_rejects_the_application()
    {
        Assert.Equal(JoinRequestStatuses.Rejected, RequestCloser.StatusFor(JoinRequestReasons.RoomFull));
    }

    [Fact]
    public void A_composition_refusal_rejects_the_application()
    {
        Assert.Equal(JoinRequestStatuses.Rejected, RequestCloser.StatusFor(JoinRequestReasons.CompositionRule));
    }

    [Fact]
    public void An_expired_grouping_rejects_the_application()
    {
        Assert.Equal(JoinRequestStatuses.Rejected, RequestCloser.StatusFor(JoinRequestReasons.GroupingExpired));
    }
}
