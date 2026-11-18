using ExeGroup.Group.Repositories;
using ExeGroup.Group.Repositories.Data;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Services.Events;
using ExeGroup.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ExeGroup.Group.IntegrationTests;

public sealed class PoisonEventStreamWriter : IEventStreamWriter
{
    public HashSet<Guid> RejectedEventIds { get; } = [];

    public Task AppendAsync(OutboxMessage message, CancellationToken cancellationToken)
    {
        if (RejectedEventIds.Contains(message.EventId))
        {
            throw new InvalidOperationException("This event can never be written.");
        }

        return Task.CompletedTask;
    }
}

public sealed class OutboxPoisonTests : IAsyncLifetime
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private ServiceApiFactory<Program> _api = null!;
    private PoisonEventStreamWriter _writer = null!;

    public async ValueTask InitializeAsync()
    {
        var connectionString = (await SqlServerContainer.SharedAsync()).NewDatabaseConnectionString("outbox-poison");
        _writer = new PoisonEventStreamWriter();
        _api = new PoisonApiFactory(connectionString, _writer);
        await _api.MigrateAsync(Ct);
    }

    public async ValueTask DisposeAsync()
    {
        await _api.DisposeAsync();
    }

    [Fact]
    public async Task A_poison_event_does_not_stop_the_events_behind_it()
    {
        var poison = await EnqueueAsync();
        var normal = await EnqueueAsync();
        _writer.RejectedEventIds.Add(poison);

        var published = await DispatchAsync();
        var stored = await QueryAsync(poison);

        Assert.Equal(1, published);
        Assert.Equal(1, stored.RetryCount);
        Assert.Null(stored.PublishedAtUtc);
        Assert.NotNull(await QueryAsync(normal));
    }

    [Fact]
    public async Task A_poison_event_is_skipped_after_enough_tries()
    {
        var poison = await EnqueueAsync();
        _writer.RejectedEventIds.Add(poison);

        for (var run = 0; run < OutboxDispatcher.MaxRetries; run++)
        {
            await DispatchAsync();
        }

        var stored = await QueryAsync(poison);

        Assert.Equal(OutboxDispatcher.MaxRetries, stored.RetryCount);
        Assert.NotNull(stored.PublishedAtUtc);
        Assert.Contains("Skipped after", stored.LastError, StringComparison.Ordinal);
    }

    private async Task<Guid> EnqueueAsync()
    {
        var eventId = Guid.NewGuid();
        await using var scope = _api.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<GroupDbContext>();
        database.OutboxEvents.Add(new OutboxEvent
        {
            EventId = eventId,
            EventType = GroupEventTypes.RoomStatusChanged,
            AggregateId = Guid.NewGuid(),
            Payload = "{}",
            OccurredAtUtc = DateTime.UtcNow,
        });
        await database.SaveChangesAsync(Ct);
        return eventId;
    }

    private async Task<int> DispatchAsync()
    {
        await using var scope = _api.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<IOutboxDispatcher>().PublishPendingAsync(Ct);
    }

    private async Task<OutboxEvent> QueryAsync(Guid eventId)
    {
        await using var scope = _api.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<GroupDbContext>().OutboxEvents.AsNoTracking().SingleAsync(outboxEvent => outboxEvent.EventId == eventId, Ct);
    }

    private sealed class PoisonApiFactory(string connectionString, PoisonEventStreamWriter writer)
        : ServiceApiFactory<Program>(DependencyInjection.ConnectionName, connectionString, GroupApiFixture.Settings)
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IEventStreamWriter>();
                services.AddSingleton<IEventStreamWriter>(writer);
            });
        }
    }
}
