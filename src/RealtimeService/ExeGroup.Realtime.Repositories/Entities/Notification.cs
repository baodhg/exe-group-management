namespace ExeGroup.Realtime.Repositories.Entities;

public sealed class Notification
{
    public Guid NotificationId { get; set; }

    public Guid UserId { get; set; }

    public string Type { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public DateTime? ReadAt { get; set; }
}

public sealed class ProcessedEvent
{
    public Guid EventId { get; set; }

    public string EventType { get; set; } = string.Empty;

    public DateTime ProcessedAtUtc { get; set; }
}
