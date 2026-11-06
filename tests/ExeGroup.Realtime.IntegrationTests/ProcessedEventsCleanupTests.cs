using ExeGroup.Realtime.API.Jobs;
using ExeGroup.Realtime.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace ExeGroup.Realtime.IntegrationTests;

public sealed class ProcessedEventsCleanupTests(RealtimeApiFixture fixture) : IClassFixture<RealtimeApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Processed_events_past_the_retention_are_deleted()
    {
        var now = DateTime.UtcNow;
        var (old, recent) = (Guid.NewGuid(), Guid.NewGuid());
        await fixture.SeedAsync(
            database =>
            {
                database.ProcessedEvents.Add(new ProcessedEvent { EventId = old, EventType = "RoomStatusChanged", ProcessedAtUtc = now.AddDays(-8) });
                database.ProcessedEvents.Add(new ProcessedEvent { EventId = recent, EventType = "RoomStatusChanged", ProcessedAtUtc = now.AddDays(-2) });
            },
            Ct);

        var byDefault = Job(fixture.Api.Services.GetRequiredService<IConfiguration>());
        var deletedByDefault = await CleanAsync(byDefault);
        var afterDefault = await RemainingAsync(old, recent);
        var oneDay = Job(new ConfigurationBuilder().AddInMemoryCollection([new(ProcessedEventsCleanup.RetentionDaysKey, "1")]).Build());
        var deletedWithOneDay = await CleanAsync(oneDay);

        Assert.Equal((7, 1), (byDefault.RetentionDays, oneDay.RetentionDays));
        Assert.Equal(1, deletedByDefault);
        Assert.Equal(recent, Assert.Single(afterDefault));
        Assert.Equal(1, deletedWithOneDay);
        Assert.Empty(await RemainingAsync(old, recent));
    }

    private ProcessedEventsCleanup Job(IConfiguration configuration) =>
        new(fixture.Api.Services.GetRequiredService<IServiceScopeFactory>(), configuration, NullLogger<ProcessedEventsCleanup>.Instance);

    private async Task<int> CleanAsync(ProcessedEventsCleanup job)
    {
        await using var scope = fixture.Api.Services.CreateAsyncScope();
        return await job.CleanAsync(scope.ServiceProvider, Ct);
    }

    private Task<List<Guid>> RemainingAsync(params Guid[] eventIds) =>
        fixture.QueryAsync(database => database.ProcessedEvents.AsNoTracking()
            .Where(item => eventIds.Contains(item.EventId))
            .Select(item => item.EventId)
            .ToListAsync(Ct));
}
