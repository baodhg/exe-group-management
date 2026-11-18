using System.ComponentModel.DataAnnotations;
using ExeGroup.Group.Services.Projects;

namespace ExeGroup.Group.API.Models.Projects;

public sealed class CreateMilestoneRequest
{
    [Required]
    [StringLength(ProjectService.MaxNameLength)]
    public string? Name { get; init; }

    [StringLength(ProjectService.MaxDescriptionLength)]
    public string? Description { get; init; }

    public int Sequence { get; init; }

    public DateTime? DueAt { get; init; }

    public int Weight { get; init; } = 1;
}

public sealed class UpdateMilestoneRequest
{
    [Required]
    [StringLength(ProjectService.MaxNameLength)]
    public string? Name { get; init; }

    [StringLength(ProjectService.MaxDescriptionLength)]
    public string? Description { get; init; }

    public int Sequence { get; init; }

    public DateTime? DueAt { get; init; }

    public int Weight { get; init; } = 1;
}

public sealed class StartDeliverableRequest
{
    [Required]
    [StringLength(ProjectService.MaxTitleLength)]
    public string? Title { get; init; }

    [StringLength(ProjectService.MaxNotesLength)]
    public string? Notes { get; init; }
}

public sealed class SubmitDeliverableRequest
{
    [StringLength(ProjectService.MaxNotesLength)]
    public string? Notes { get; init; }
}

public sealed class ReviewDeliverableRequest
{
    [Required]
    [StringLength(20)]
    public string? Decision { get; init; }

    [StringLength(ProjectService.MaxNoteLength)]
    public string? Note { get; init; }

    public decimal? Score { get; init; }
}

public sealed record MilestoneResponse(
    Guid Id,
    Guid CourseId,
    string Name,
    string? Description,
    int Sequence,
    DateTime? DueAt,
    int Weight,
    int GroupCount,
    int SubmittedCount,
    int ApprovedCount,
    int ProgressPercent,
    DateTime CreatedAt);

public sealed record DeliverableResponse(
    Guid Id,
    Guid MilestoneId,
    Guid CourseId,
    Guid RoomId,
    string RoomName,
    int? GroupNo,
    string Title,
    string? Notes,
    string Status,
    Guid? SubmittedBy,
    DateTime? SubmittedAt,
    Guid? ReviewedBy,
    DateTime? ReviewedAt,
    decimal? Score,
    string? ReviewNote,
    DateTime CreatedAt);

public sealed record ProjectGroupProgressResponse(
    Guid RoomId,
    string RoomName,
    int? GroupNo,
    string? Topic,
    int ProgressPercent,
    decimal? AverageScore,
    IReadOnlyList<MilestoneResponse> Milestones);

public sealed record ProjectBoardResponse(
    Guid CourseId,
    string CourseName,
    string Phase,
    int OverallPercent,
    IReadOnlyList<MilestoneResponse> Milestones,
    IReadOnlyList<DeliverableResponse> Deliverables,
    IReadOnlyList<ProjectGroupProgressResponse> Groups);

public static class ProjectMappings
{
    public static MilestoneResponse ToResponse(this MilestoneModel model) =>
        new(
            model.Id,
            model.CourseId,
            model.Name,
            model.Description,
            model.Sequence,
            model.DueAt,
            model.Weight,
            model.GroupCount,
            model.SubmittedCount,
            model.ApprovedCount,
            model.ProgressPercent,
            model.CreatedAt);

    public static DeliverableResponse ToResponse(this DeliverableModel model) =>
        new(
            model.Id,
            model.MilestoneId,
            model.CourseId,
            model.RoomId,
            model.RoomName,
            model.GroupNo,
            model.Title,
            model.Notes,
            model.Status,
            model.SubmittedBy,
            model.SubmittedAt,
            model.ReviewedBy,
            model.ReviewedAt,
            model.Score,
            model.ReviewNote,
            model.CreatedAt);

    public static ProjectBoardResponse ToResponse(this ProjectBoardModel model) =>
        new(
            model.CourseId,
            model.CourseName,
            model.Phase,
            model.OverallPercent,
            model.Milestones.Select(milestone => milestone.ToResponse()).ToList(),
            model.Deliverables.Select(deliverable => deliverable.ToResponse()).ToList(),
            model.Groups
                .Select(group => new ProjectGroupProgressResponse(
                    group.RoomId,
                    group.RoomName,
                    group.GroupNo,
                    group.Topic,
                    group.ProgressPercent,
                    group.AverageScore,
                    group.Milestones.Select(milestone => milestone.ToResponse()).ToList()))
                .ToList());
}
