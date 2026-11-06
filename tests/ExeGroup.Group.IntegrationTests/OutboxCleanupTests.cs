using ExeGroup.Group.API.Jobs;
using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace ExeGroup.Group.IntegrationTests;

public sealed class OutboxCleanupTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Published_events_past_the_retention_are_deleted_and_unpublished_ones_stay()
    {
        var now = DateTime.UtcNow;
        var (old, recent, unpublished) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        await fixture.SeedAsync(
            database =>
            {
                database.OutboxEvents.Add(Event(old, now.AddDays(-9), now.AddDays(-8)));
                database.OutboxEvents.Add(Event(recent, now.AddDays(-3), now.AddDays(-2)));
                database.OutboxEvents.Add(Event(unpublished, now.AddDays(-30), null));
            },
            Ct);

        var byDefault = Job(fixture.Api.Services.GetRequiredService<IConfiguration>());
        var deletedByDefault = await CleanAsync(byDefault);
        var afterDefault = await RemainingAsync(old, recent, unpublished);
        var oneDay = Job(new ConfigurationBuilder().AddInMemoryCollection([new(OutboxCleanup.RetentionDaysKey, "1")]).Build());
        var deletedWithOneDay = await CleanAsync(oneDay);
        var afterOneDay = await RemainingAsync(old, recent, unpublished);

        Assert.Equal((7, 1), (byDefault.RetentionDays, oneDay.RetentionDays));
        Assert.Equal(1, deletedByDefault);
        Assert.Equal(new[] { recent, unpublished }.Order(), afterDefault.Order());
        Assert.Equal(1, deletedWithOneDay);
        Assert.Equal(unpublished, Assert.Single(afterOneDay));
    }

    private OutboxCleanup Job(IConfiguration configuration) =>
        new(fixture.Api.Services.GetRequiredService<IServiceScopeFactory>(), configuration, NullLogger<OutboxCleanup>.Instance);

    private async Task<int> CleanAsync(OutboxCleanup job)
    {
        await using var scope = fixture.Api.Services.CreateAsyncScope();
        return await job.CleanAsync(scope.ServiceProvider, Ct);
    }

    private Task<List<Guid>> RemainingAsync(params Guid[] eventIds) =>
        fixture.QueryAsync(database => database.OutboxEvents.AsNoTracking()
            .Where(item => eventIds.Contains(item.EventId))
            .Select(item => item.EventId)
            .ToListAsync(Ct));

    private static OutboxEvent Event(Guid eventId, DateTime occurredAt, DateTime? publishedAt) =>
        new()
        {
            EventId = eventId,
            EventType = "RoomStatusChanged",
            AggregateId = Guid.NewGuid(),
            Payload = "{}",
            OccurredAtUtc = occurredAt,
            PublishedAtUtc = publishedAt,
        };
}
