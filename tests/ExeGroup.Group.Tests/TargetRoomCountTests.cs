using ExeGroup.Group.Services.Rooms;

namespace ExeGroup.Group.Tests;

public sealed class TargetRoomCountTests
{
    [Fact]
    public void An_empty_class_has_no_room()
    {
        Assert.Equal(0, RoomService.TargetRoomCount(0, 6, 1.2m));
    }

    [Fact]
    public void A_class_fits_into_the_rooms_of_its_maximum_group_size()
    {
        Assert.Equal(5, RoomService.TargetRoomCount(30, 6, 1m));
        Assert.Equal(6, RoomService.TargetRoomCount(30, 6, 1.2m));
    }

    [Fact]
    public void A_room_factor_creates_the_extra_rooms()
    {
        Assert.Equal(9, RoomService.TargetRoomCount(30, 6, 1.8m));
    }

    [Fact]
    public void A_partial_group_still_gets_a_whole_room()
    {
        Assert.Equal(1, RoomService.TargetRoomCount(1, 6, 1m));
        Assert.Equal(2, RoomService.TargetRoomCount(7, 6, 1m));
    }

    [Fact]
    public void More_students_never_need_fewer_rooms()
    {
        var few = RoomService.TargetRoomCount(24, 6, 1.2m);
        var many = RoomService.TargetRoomCount(30, 6, 1.2m);

        Assert.True(many >= few);
    }
}
