using ExeGroup.BuildingBlocks.Web.Jobs;
using ExeGroup.Group.Services.Events;

namespace ExeGroup.Group.API.Jobs;

public sealed class OutboxPublisher(IServiceScopeFactory scopes, ILogger<OutboxPublisher> logger) : PeriodicBackgroundService(scopes, logger)
{
    public const string EnabledKey = "Jobs:OutboxPublisher:Enabled";

    protected override string JobName => nameof(OutboxPublisher);

    protected override TimeSpan Interval => TimeSpan.FromSeconds(2);

    protected override async Task RunOnceAsync(IServiceProvider services, CancellationToken cancellationToken)
    {
        var published = await services.GetRequiredService<IOutboxDispatcher>().PublishPendingAsync(cancellationToken);
        if (published > 0)
        {
            logger.LogInformation("Published {Count} group events", published);
        }
    }
}
