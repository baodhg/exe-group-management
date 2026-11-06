using System.Globalization;
using ExeGroup.Group.Services.Events;
using StackExchange.Redis;

namespace ExeGroup.Group.API.Events;

public sealed class RedisEventStreamWriter(IConnectionMultiplexer redis) : IEventStreamWriter
{
    public const string StreamName = "group-events";
    public const int MaxStreamLength = 100_000;

    public async Task AppendAsync(OutboxMessage message, CancellationToken cancellationToken)
    {
        NameValueEntry[] fields =
        [
            new("eventId", message.EventId.ToString()),
            new("type", message.EventType),
            new("aggregateId", message.AggregateId.ToString()),
            new("payload", message.Payload),
            new("correlationId", message.CorrelationId ?? string.Empty),
            new("occurredAt", message.OccurredAtUtc.ToString("O", CultureInfo.InvariantCulture)),
        ];
        await redis.GetDatabase().StreamAddAsync(StreamName, fields, maxLength: MaxStreamLength, useApproximateMaxLength: true).WaitAsync(cancellationToken);
    }
}
