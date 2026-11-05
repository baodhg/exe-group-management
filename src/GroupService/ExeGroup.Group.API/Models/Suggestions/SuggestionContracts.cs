using ExeGroup.Group.API.Models.Rooms;
using ExeGroup.Group.Services.Suggestions;

namespace ExeGroup.Group.API.Models.Suggestions;

public sealed record SuggestionReasonResponse(string Code, string Detail);

public sealed record SuggestedRoomResponse(RoomSummaryResponse Room, double? Score, IReadOnlyList<SuggestionReasonResponse> Reasons);

public sealed record RoomSuggestionsResponse(bool Ranked, IReadOnlyList<SuggestedRoomResponse> Rooms);

public sealed record StudentRefResponse(Guid StudentId, string StudentCode, string FullName, string MajorCode);

public sealed record PlacementResponse(StudentRefResponse Student, Guid RoomId, string RoomName, IReadOnlyList<SuggestionReasonResponse> Reasons);

public sealed record PlacementSuggestionsResponse(
    bool Ranked,
    IReadOnlyList<PlacementResponse> Placements,
    IReadOnlyList<StudentRefResponse> Unplaced,
    IReadOnlyList<RoomSummaryResponse> Rooms);

public static class SuggestionMappings
{
    public static RoomSuggestionsResponse ToResponse(this RoomSuggestionsModel model) =>
        new(
            model.Ranked,
            model.Rooms.Select(room => new SuggestedRoomResponse(room.Room.ToResponse(), room.Score, Reasons(room.Reasons))).ToList());

    public static PlacementSuggestionsResponse ToResponse(this PlacementSuggestionsModel model) =>
        new(
            model.Ranked,
            model.Placements.Select(placement => new PlacementResponse(Student(placement.Student), placement.RoomId, placement.RoomName, Reasons(placement.Reasons))).ToList(),
            model.Unplaced.Select(Student).ToList(),
            model.Rooms.Select(room => room.ToResponse()).ToList());

    private static StudentRefResponse Student(StudentRefModel student) => new(student.StudentId, student.StudentCode, student.FullName, student.MajorCode);

    private static List<SuggestionReasonResponse> Reasons(IReadOnlyList<SuggestionReasonModel> reasons) =>
        reasons.Select(reason => new SuggestionReasonResponse(reason.Code, reason.Detail)).ToList();
}
