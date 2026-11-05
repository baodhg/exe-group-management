using System.Text.Json;
using ExeGroup.Group.Repositories;
using ExeGroup.Group.Repositories.Data;
using ExeGroup.Group.Services.Events;
using ExeGroup.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;

namespace ExeGroup.Group.IntegrationTests;

public sealed class OutboxTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Events_saved_with_a_change_reach_the_group_events_stream()
    {
        var redis = await RedisContainer.SharedAsync();
        var connectionString = (await SqlServerContainer.SharedAsync()).NewDatabaseConnectionString("outbox");
        await using var api = NewApi(connectionString, redis.ConnectionString);
        await api.MigrateAsync(Ct);
        var roomId = Guid.NewGuid();
        var eventId = await EnqueueAsync(api, roomId);

        var published = await DispatchAsync(api);
        await using var connection = await ConnectionMultiplexer.ConnectAsync(redis.ConnectionString);
        var entries = await connection.GetDatabase().StreamRangeAsync("group-events");
        var entry = entries.Single(candidate => candidate["eventId"] == eventId.ToString());
        var stored = await QueryAsync(api, eventId);

        Assert.Equal(1, published);
        Assert.Equal(GroupEventTypes.RoomStatusChanged, (string?)entry["type"]);
        Assert.Equal(roomId, JsonDocument.Parse((string)entry["payload"]!).RootElement.GetProperty("roomId").GetGuid());
        Assert.NotNull(stored.PublishedAtUtc);
    }

    [Fact]
    public async Task An_event_that_cannot_be_sent_is_sent_on_a_later_run()
    {
        var redis = await RedisContainer.SharedAsync();
        var connectionString = (await SqlServerContainer.SharedAsync()).NewDatabaseConnectionString("outbox");
        await using var redisDown = NewApi(connectionString, "127.0.0.1:1,abortConnect=false,connectTimeout=500");
        await redisDown.MigrateAsync(Ct);
        var eventId = await EnqueueAsync(redisDown, Guid.NewGuid());

        var whileDown = await DispatchAsync(redisDown);
        var failed = await QueryAsync(redisDown, eventId);
        await using var redisUp = NewApi(connectionString, redis.ConnectionString);
        var afterRecovery = await DispatchAsync(redisUp);
        var sent = await QueryAsync(redisUp, eventId);

        Assert.Equal(0, whileDown);
        Assert.Equal(1, failed.RetryCount);
        Assert.NotNull(failed.LastError);
        Assert.Null(failed.PublishedAtUtc);
        Assert.Equal(1, afterRecovery);
        Assert.NotNull(sent.PublishedAtUtc);
    }

    private static ServiceApiFactory<Program> NewApi(string connectionString, string redis) =>
        new(DependencyInjection.ConnectionName, connectionString, new Dictionary<string, string?>(GroupApiFixture.Settings) { ["Redis:Connection"] = redis });

    private static async Task<Guid> EnqueueAsync(ServiceApiFactory<Program> api, Guid roomId)
    {
        await using var scope = api.Services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<IOutbox>().Enqueue(
            GroupEventTypes.RoomStatusChanged,
            roomId,
            new RoomStatusChangedEvent(Guid.NewGuid(), roomId, "Room 1", "Locked"));
        var database = scope.ServiceProvider.GetRequiredService<GroupDbContext>();
        await database.SaveChangesAsync(Ct);
        return await database.OutboxEvents.Where(outboxEvent => outboxEvent.AggregateId == roomId).Select(outboxEvent => outboxEvent.EventId).SingleAsync(Ct);
    }

    private static async Task<int> DispatchAsync(ServiceApiFactory<Program> api)
    {
        await using var scope = api.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<IOutboxDispatcher>().PublishPendingAsync(Ct);
    }

    private static async Task<Repositories.Entities.OutboxEvent> QueryAsync(ServiceApiFactory<Program> api, Guid eventId)
    {
        await using var scope = api.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<GroupDbContext>().OutboxEvents.AsNoTracking().SingleAsync(outboxEvent => outboxEvent.EventId == eventId, Ct);
    }
}
