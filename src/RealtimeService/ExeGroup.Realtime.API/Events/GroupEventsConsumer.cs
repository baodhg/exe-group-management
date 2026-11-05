using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Hosting;
using ExeGroup.BuildingBlocks.Web.Observability;
using ExeGroup.Realtime.Services.Events;
using StackExchange.Redis;

namespace ExeGroup.Realtime.API.Events;

public sealed class GroupEventsConsumer(
    IConnectionMultiplexer redis,
    IServiceScopeFactory scopes,
    IConfiguration configuration,
    ILogger<GroupEventsConsumer> logger) : BackgroundService
{
    public const string EnabledKey = "Jobs:GroupEventsConsumer:Enabled";
    public const string StreamKey = "Jobs:GroupEventsConsumer:Stream";
    public const string ConsumerKey = "Jobs:GroupEventsConsumer:ConsumerName";
    public const string ClaimAfterKey = "Jobs:GroupEventsConsumer:ClaimAfterSeconds";
    public const string DefaultStream = "group-events";
    public const string GroupName = "realtime";
    public const string DefaultConsumer = "realtime-1";
    public const int BatchSize = 50;

    private static readonly TimeSpan IdleDelay = TimeSpan.FromSeconds(1);
    private static readonly TimeSpan ErrorDelay = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan ClaimEvery = TimeSpan.FromSeconds(30);

    public string Stream => configuration[StreamKey] ?? DefaultStream;

    public string Consumer => configuration[ConsumerKey] ?? DefaultConsumer;

    public TimeSpan ClaimAfter => TimeSpan.FromSeconds(Math.Max(0, configuration.GetValue(ClaimAfterKey, 60)));

    public async Task<int> CatchUpAsync(CancellationToken cancellationToken)
    {
        await EnsureGroupAsync();
        var handled = await HandleAllAsync(await redis.GetDatabase().StreamReadGroupAsync(Stream, GroupName, Consumer, StreamPosition.Beginning, BatchSize), cancellationToken);
        handled += await ClaimStaleAsync(cancellationToken);
        while (await ReadNewAsync(cancellationToken) is var count and > 0)
        {
            handled += count;
        }

        return handled;
    }

    public async Task<int> ReadNewAsync(CancellationToken cancellationToken) =>
        await HandleAllAsync(await redis.GetDatabase().StreamReadGroupAsync(Stream, GroupName, Consumer, StreamPosition.NewMessages, BatchSize), cancellationToken);

    public async Task<int> ClaimStaleAsync(CancellationToken cancellationToken)
    {
        var claimed = await redis.GetDatabase().StreamAutoClaimAsync(Stream, GroupName, Consumer, (long)ClaimAfter.TotalMilliseconds, "0-0", BatchSize);
        return await HandleAllAsync(claimed.ClaimedEntries, cancellationToken);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await WaitForDatabaseAsync(stoppingToken);
        logger.LogInformation("Consuming {Stream} as {Consumer} in group {Group}", Stream, Consumer, GroupName);
        var caughtUp = false;
        var lastClaim = DateTime.UtcNow;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (!caughtUp)
                {
                    var handled = await CatchUpAsync(stoppingToken);
                    logger.LogInformation("Caught up on {Count} group events", handled);
                    caughtUp = true;
                }

                if (DateTime.UtcNow - lastClaim >= ClaimEvery)
                {
                    await ClaimStaleAsync(stoppingToken);
                    lastClaim = DateTime.UtcNow;
                }

                if (await ReadNewAsync(stoppingToken) == 0)
                {
                    await Task.Delay(IdleDelay, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "Reading {Stream} failed; trying again in {Delay}", Stream, ErrorDelay);
                await Task.Delay(ErrorDelay, stoppingToken);
            }
        }
    }

    private async Task EnsureGroupAsync()
    {
        try
        {
            await redis.GetDatabase().StreamCreateConsumerGroupAsync(Stream, GroupName, StreamPosition.Beginning, createStream: true);
        }
        catch (RedisServerException exception) when (exception.Message.Contains("BUSYGROUP", StringComparison.Ordinal))
        {
        }
    }

    private async Task<int> HandleAllAsync(StreamEntry[] entries, CancellationToken cancellationToken)
    {
        var handled = 0;
        foreach (var entry in entries.Where(entry => !entry.IsNull))
        {
            if (await HandleAsync(entry, cancellationToken))
            {
                handled++;
            }
        }

        return handled;
    }

    private async Task<bool> HandleAsync(StreamEntry entry, CancellationToken cancellationToken)
    {
        if (!TryRead(entry, out var message))
        {
            logger.LogError("Dropped stream entry {EntryId}: it is not a group event", entry.Id);
            await AckAsync(entry);
            return false;
        }

        await using var scope = scopes.CreateAsyncScope();
        var correlation = scope.ServiceProvider.GetService<ICorrelationContext>() ?? new CorrelationContext();
        using (CorrelationScope.Begin(correlation, string.IsNullOrWhiteSpace(message.CorrelationId) ? $"event-{message.EventId:N}" : message.CorrelationId))
        {
            try
            {
                var applied = await scope.ServiceProvider.GetRequiredService<IGroupEventHandler>().HandleAsync(message, cancellationToken);
                await AckAsync(entry);
                return applied;
            }
            catch (JsonException exception)
            {
                logger.LogError(exception, "Dropped event {EventId} ({EventType}): its payload cannot be read", message.EventId, message.Type);
                await AckAsync(entry);
                return false;
            }
            catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
            {
                logger.LogWarning(exception, "Event {EventId} ({EventType}) failed; it stays pending and is retried after {ClaimAfter}", message.EventId, message.Type, ClaimAfter);
                return false;
            }
        }
    }

    private Task AckAsync(StreamEntry entry) => redis.GetDatabase().StreamAcknowledgeAsync(Stream, GroupName, entry.Id);

    private async Task WaitForDatabaseAsync(CancellationToken stoppingToken)
    {
        await using var scope = scopes.CreateAsyncScope();
        if (scope.ServiceProvider.GetService<DatabaseReadiness>() is { IsReady: false } readiness)
        {
            await readiness.WhenReady.WaitAsync(stoppingToken);
        }
    }

    private static bool TryRead(StreamEntry entry, out GroupEventMessage message)
    {
        string? Field(string name) => entry.Values.FirstOrDefault(value => value.Name == name).Value is { IsNull: false } value ? value.ToString() : null;

        message = null!;
        if (!Guid.TryParse(Field("eventId"), out var eventId) || Field("type") is not { Length: > 0 } type || Field("payload") is not { } payload)
        {
            return false;
        }

        message = new GroupEventMessage(eventId, type, Guid.TryParse(Field("aggregateId"), out var aggregateId) ? aggregateId : Guid.Empty, payload, Field("correlationId"));
        return true;
    }
}
