using System.ComponentModel.DataAnnotations;
using ExeGroup.Group.API.Models.Rooms;
using ExeGroup.Group.API.Models.Suggestions;
using ExeGroup.Group.Services.Courses;

namespace ExeGroup.Group.API.Models.Courses;

public sealed class PlacementItemRequest
{
    [Required]
    public Guid? StudentId { get; init; }

    [Required]
    public Guid? RoomId { get; init; }
}

public sealed class PlacementsRequest
{
    [Required]
    [MinLength(1)]
    [MaxLength(CourseProgressService.MaxPlacements)]
    public List<PlacementItemRequest>? Placements { get; init; }

    public IReadOnlyList<PlacementRequest> ToPlacements() =>
        (Placements ?? []).Select(item => new PlacementRequest(item.StudentId!.Value, item.RoomId!.Value)).ToList();
}

public sealed class FinalizeRequest
{
    public bool AcceptExceptions { get; init; }
}

public sealed record OverviewRoomResponse(RoomSummaryResponse Room, int MissingMembers, int MissingMajorSeats, IReadOnlyList<MajorCountResponse> Majors);

public sealed record CourseOverviewResponse(
    Guid CourseId,
    string Phase,
    DateTime? ExpireAt,
    DateTime? FinalizedAt,
    int MinGroupSize,
    int StudentCount,
    int PlacedCount,
    int RoomCount,
    int EmptyRoomCount,
    int EligibleRoomCount,
    IReadOnlyList<StudentRefResponse> Unplaced,
    IReadOnlyList<OverviewRoomResponse> IneligibleRooms);

public sealed record FinalizeResponse(CourseResponse Course, int Groups, int DeletedRooms);

public static class CourseProgressMappings
{
    public static CourseOverviewResponse ToResponse(this CourseOverviewModel model) =>
        new(
            model.CourseId,
            model.Phase,
            model.ExpireAt,
            model.FinalizedAt,
            model.MinGroupSize,
            model.StudentCount,
            model.PlacedCount,
            model.RoomCount,
            model.EmptyRoomCount,
            model.EligibleRoomCount,
            model.Unplaced.Select(student => new StudentRefResponse(student.StudentId, student.StudentCode, student.FullName, student.MajorCode)).ToList(),
            model.IneligibleRooms
                .Select(room => new OverviewRoomResponse(
                    room.Room.ToResponse(),
                    room.MissingMembers,
                    room.MissingMajorSeats,
                    room.Majors.Select(major => new MajorCountResponse(major.MajorId, major.MajorCode, major.Members, major.Required)).ToList()))
                .ToList());

    public static FinalizeResponse ToResponse(this FinalizeResultModel model) => new(model.Course.ToResponse(), model.Groups, model.DeletedRooms);
}
