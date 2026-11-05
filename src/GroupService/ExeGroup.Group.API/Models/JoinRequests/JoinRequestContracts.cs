using System.ComponentModel.DataAnnotations;
using ExeGroup.Group.API.Models.Rooms;
using ExeGroup.Group.Services.JoinRequests;

namespace ExeGroup.Group.API.Models.JoinRequests;

public sealed class SubmitJoinRequestRequest
{
    [Required]
    public Guid? RoomId { get; init; }

    [StringLength(JoinRequestService.MaxTextLength)]
    public string? Message { get; init; }
}

public sealed class RejectJoinRequestRequest
{
    [StringLength(JoinRequestService.MaxTextLength)]
    public string? ReasonText { get; init; }
}

public sealed record JoinRequestResponse(
    Guid Id,
    Guid CourseId,
    Guid RoomId,
    string RoomName,
    Guid StudentId,
    string? StudentCode,
    string? StudentName,
    string? MajorCode,
    IReadOnlyList<RoomSkillResponse> Skills,
    string? Message,
    string Status,
    string? ReasonCode,
    string? ReasonText,
    Guid? DecidedBy,
    DateTime? DecidedAt,
    DateTime CreatedAt);

public static class JoinRequestMappings
{
    public static JoinRequestResponse ToResponse(this JoinRequestModel model) =>
        new(
            model.Id,
            model.CourseId,
            model.RoomId,
            model.RoomName,
            model.StudentId,
            model.StudentCode,
            model.StudentName,
            model.MajorCode,
            model.Skills.Select(skill => new RoomSkillResponse(skill.SkillCode, skill.Level)).ToList(),
            model.Message,
            model.Status,
            model.ReasonCode,
            model.ReasonText,
            model.DecidedBy,
            model.DecidedAt,
            model.CreatedAt);
}
