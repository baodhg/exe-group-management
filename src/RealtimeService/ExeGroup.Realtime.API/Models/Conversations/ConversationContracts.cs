using System.ComponentModel.DataAnnotations;
using ExeGroup.Realtime.Services.Conversations;

namespace ExeGroup.Realtime.API.Models.Conversations;

public sealed class SendMessageRequest
{
    [Required]
    [StringLength(ConversationService.MaxContentLength, MinimumLength = 1)]
    public string? Content { get; init; }
}

public sealed record MessageResponse(Guid Id, Guid ConversationId, Guid SenderId, string SenderName, string? Content, DateTime SentAt, bool Deleted);

public sealed record MessagePageResponse(IReadOnlyList<MessageResponse> Items, Guid? NextBefore);

public sealed record ConversationResponse(Guid Id, Guid CourseId, string Title, DateTime JoinedAt, DateTime? LeftAt, bool CanSend, MessageResponse? LastMessage);

public static class ConversationMappings
{
    public static MessageResponse ToResponse(this MessageModel model) =>
        new(model.Id, model.ConversationId, model.SenderId, model.SenderName, model.Content, model.SentAt, model.Deleted);

    public static MessagePageResponse ToResponse(this MessagePage page) =>
        new(page.Items.Select(item => item.ToResponse()).ToList(), page.NextBefore);

    public static ConversationResponse ToResponse(this ConversationModel model) =>
        new(model.Id, model.CourseId, model.Title, model.JoinedAt, model.LeftAt, model.LeftAt is null, model.LastMessage?.ToResponse());
}
