namespace ExeGroup.Realtime.Repositories.Entities;

public sealed class Message
{
    public Guid MessageId { get; set; }

    public Guid ConversationId { get; set; }

    public Guid SenderId { get; set; }

    public string SenderName { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    public DateTime SentAt { get; set; }

    public DateTime? DeletedAt { get; set; }
}
