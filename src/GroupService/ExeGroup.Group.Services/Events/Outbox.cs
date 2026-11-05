using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using Microsoft.Extensions.Logging;

namespace ExeGroup.Group.Services.Events;

public interface IOutbox
{
    void Enqueue<TPayload>(string eventType, Guid aggregateId, TPayload payload)
        where TPayload : notnull;
}

public sealed class Outbox(IOutboxRepository outbox, IClock clock, ICorrelationContext correlation) : IOutbox
{
    public static readonly JsonSerializerOptions PayloadJson = new(JsonSerializerDefaults.Web);

    public void Enqueue<TPayload>(string eventType, Guid aggregateId, TPayload payload)
        where TPayload : notnull =>
        outbox.Add(new OutboxEvent
        {
            EventId = Guid.NewGuid(),
            EventType = eventType,
            AggregateId = aggregateId,
            Payload = JsonSerializer.Serialize(payload, PayloadJson),
            CorrelationId = correlation.CorrelationId,
            OccurredAtUtc = clock.UtcNow,
        });
}

public sealed record OutboxMessage(Guid EventId, string EventType, Guid AggregateId, string Payload, string? CorrelationId, DateTime OccurredAtUtc);

public interface IEventStreamWriter
{
    Task AppendAsync(OutboxMessage message, CancellationToken cancellationToken);
}

public interface IOutboxDispatcher
{
    Task<int> PublishPendingAsync(CancellationToken cancellationToken);

    Task<int> DeletePublishedAsync(TimeSpan olderThan, CancellationToken cancellationToken);
}

public sealed class OutboxDispatcher(
    IOutboxRepository outbox,
    IEventStreamWriter writer,
    IClock clock,
    ILogger<OutboxDispatcher> logger) : IOutboxDispatcher
{
    public const int BatchSize = 100;
    public const int MaxErrorLength = 1000;

    public async Task<int> PublishPendingAsync(CancellationToken cancellationToken)
    {
        var published = 0;
        foreach (var pending in await outbox.ListUnpublishedAsync(BatchSize, cancellationToken))
        {
            try
            {
                await writer.AppendAsync(
                    new OutboxMessage(pending.EventId, pending.EventType, pending.AggregateId, pending.Payload, pending.CorrelationId, pending.OccurredAtUtc),
                    cancellationToken);
                pending.PublishedAtUtc = clock.UtcNow;
                published++;
            }
            catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
            {
                pending.RetryCount++;
                pending.LastError = exception.Message.Length > MaxErrorLength ? exception.Message[..MaxErrorLength] : exception.Message;
                logger.LogWarning("Event {EventId} ({EventType}) was not published (try {RetryCount}): {Reason}", pending.EventId, pending.EventType, pending.RetryCount, exception.Message);
                await outbox.SaveChangesAsync(cancellationToken);
                break;
            }

            await outbox.SaveChangesAsync(cancellationToken);
        }

        return published;
    }

    public Task<int> DeletePublishedAsync(TimeSpan olderThan, CancellationToken cancellationToken) =>
        outbox.DeletePublishedBeforeAsync(clock.UtcNow - olderThan, cancellationToken);
}
