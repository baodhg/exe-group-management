namespace ExeGroup.Group.Repositories.Entities;

public sealed class OutboxEvent
{
    public Guid EventId { get; set; }

    public string EventType { get; set; } = string.Empty;

    public Guid AggregateId { get; set; }

    public string Payload { get; set; } = string.Empty;

    public string? CorrelationId { get; set; }

    public DateTime OccurredAtUtc { get; set; }

    public DateTime? PublishedAtUtc { get; set; }

    public int RetryCount { get; set; }

    public string? LastError { get; set; }
}
