using System.ComponentModel.DataAnnotations;
using ExeGroup.Group.Services.Rooms;

namespace ExeGroup.Group.API.Models.Rooms;

public sealed class UpdateRoomRequest
{
    [StringLength(50, MinimumLength = 1)]
    public string? Name { get; init; }

    [StringLength(200)]
    public string? Topic { get; init; }

    public Guid? GroupTypeId { get; init; }
}

public sealed class RemoveMemberRequest
{
    [Required]
    [StringLength(RoomMembershipService.MaxRemovalNoteLength, MinimumLength = 1)]
    public string? Reason { get; init; }
}

public sealed class GenerateRoomsRequest
{
    [Required]
    public Guid? GroupTypeId { get; init; }
}

public sealed class HandOverRequest
{
    [Required]
    public Guid? StudentId { get; init; }
}

public sealed record RoomSummaryResponse(
    Guid Id,
    Guid CourseId,
    string Name,
    string? Topic,
    string Status,
    int Capacity,
    int MemberCount,
    int FreeSeats,
    Guid GroupTypeId,
    string GroupTypeCode,
    Guid? LeaderId,
    string? LeaderName,
    int? GroupNo);

public sealed record RoomMemberResponse(
    Guid StudentId,
    string StudentCode,
    string FullName,
    Guid MajorId,
    string MajorCode,
    DateTime JoinedAt,
    string JoinedVia,
    bool IsLeader,
    IReadOnlyList<RoomSkillResponse> Skills);

public sealed record RoomSkillResponse(string SkillCode, byte Level);

public sealed record MajorCountResponse(Guid MajorId, string MajorCode, int Members, int Required);

public sealed record RoomDetailResponse(
    Guid Id,
    Guid CourseId,
    string Name,
    string? Topic,
    string Status,
    int Capacity,
    int MemberCount,
    int FreeSeats,
    Guid GroupTypeId,
    string GroupTypeCode,
    string GroupTypeName,
    Guid? LeaderId,
    string? LeaderName,
    int? GroupNo,
    int MinGroupSize,
    int MinDistinctMajors,
    bool Eligible,
    IReadOnlyList<MajorCountResponse> Majors,
    IReadOnlyList<RoomMemberResponse> Members);

public sealed record RoomGenerationResponse(int Target, int Created, IReadOnlyList<RoomSummaryResponse> Rooms);

public static class RoomMappings
{
    public static RoomGenerationResponse ToResponse(this RoomGenerationModel model) =>
        new(model.Target, model.Created, model.Rooms.Select(room => room.ToResponse()).ToList());

    public static RoomSummaryResponse ToResponse(this RoomSummaryModel model) =>
        new(
            model.Id,
            model.CourseId,
            model.Name,
            model.Topic,
            model.Status,
            model.Capacity,
            model.MemberCount,
            model.FreeSeats,
            model.GroupTypeId,
            model.GroupTypeCode,
            model.LeaderId,
            model.LeaderName,
            model.GroupNo);

    public static RoomDetailResponse ToResponse(this RoomDetailModel model) =>
        new(
            model.Summary.Id,
            model.Summary.CourseId,
            model.Summary.Name,
            model.Summary.Topic,
            model.Summary.Status,
            model.Summary.Capacity,
            model.Summary.MemberCount,
            model.Summary.FreeSeats,
            model.Summary.GroupTypeId,
            model.Summary.GroupTypeCode,
            model.GroupTypeName,
            model.Summary.LeaderId,
            model.Summary.LeaderName,
            model.Summary.GroupNo,
            model.MinGroupSize,
            model.MinDistinctMajors,
            model.Eligible,
            model.Majors.Select(major => new MajorCountResponse(major.MajorId, major.MajorCode, major.Members, major.Required)).ToList(),
            model.Members
                .Select(member => new RoomMemberResponse(
                    member.StudentId,
                    member.StudentCode,
                    member.FullName,
                    member.MajorId,
                    member.MajorCode,
                    member.JoinedAt,
                    member.JoinedVia,
                    member.IsLeader,
                    member.Skills.Select(skill => new RoomSkillResponse(skill.SkillCode, skill.Level)).ToList()))
                .ToList());
}
