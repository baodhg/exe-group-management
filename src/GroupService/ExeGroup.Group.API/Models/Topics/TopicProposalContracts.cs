using System.ComponentModel.DataAnnotations;
using ExeGroup.Group.Services.Topics;

namespace ExeGroup.Group.API.Models.Topics;

public sealed class ProposeTopicRequest
{
    [Required]
    [StringLength(TopicProposalService.MaxTopicLength)]
    public string? Topic { get; init; }

    [StringLength(TopicProposalService.MaxDescriptionLength)]
    public string? Description { get; init; }
}

public sealed class ReviewTopicProposalRequest
{
    [Required]
    [StringLength(20)]
    public string? Decision { get; init; }

    [StringLength(TopicProposalService.MaxNoteLength)]
    public string? Note { get; init; }
}

public sealed record TopicProposalResponse(
    Guid Id,
    Guid CourseId,
    Guid RoomId,
    string RoomName,
    int? GroupNo,
    int Round,
    string ProposedTopic,
    string? Description,
    Guid ProposedBy,
    string Status,
    Guid? ReviewedBy,
    DateTime? ReviewedAt,
    string? ReviewNote,
    DateTime CreatedAt);

public static class TopicProposalMappings
{
    public static TopicProposalResponse ToResponse(this TopicProposalModel model) =>
        new(
            model.Id,
            model.CourseId,
            model.RoomId,
            model.RoomName,
            model.GroupNo,
            model.Round,
            model.ProposedTopic,
            model.Description,
            model.ProposedBy,
            model.Status,
            model.ReviewedBy,
            model.ReviewedAt,
            model.ReviewNote,
            model.CreatedAt);
}
