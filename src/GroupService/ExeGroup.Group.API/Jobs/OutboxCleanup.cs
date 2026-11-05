using ExeGroup.BuildingBlocks.Web.Jobs;
using ExeGroup.Group.Services.Events;

namespace ExeGroup.Group.API.Jobs;

public sealed class OutboxCleanup(IServiceScopeFactory scopes, IConfiguration configuration, ILogger<OutboxCleanup> logger)
    : PeriodicBackgroundService(scopes, logger)
{
    public const string EnabledKey = "Jobs:OutboxCleanup:Enabled";
    public const string RetentionDaysKey = "Jobs:OutboxCleanup:RetentionDays";
    public const int DefaultRetentionDays = 7;

    protected override string JobName => nameof(OutboxCleanup);

    protected override TimeSpan Interval => TimeSpan.FromDays(1);

    public int RetentionDays => Math.Max(1, configuration.GetValue(RetentionDaysKey, DefaultRetentionDays));

    public async Task<int> CleanAsync(IServiceProvider services, CancellationToken cancellationToken)
    {
        var deleted = await services.GetRequiredService<IOutboxDispatcher>().DeletePublishedAsync(TimeSpan.FromDays(RetentionDays), cancellationToken);
        logger.LogInformation("Deleted {Count} group events published more than {Days} days ago", deleted, RetentionDays);
        return deleted;
    }

    protected override Task RunOnceAsync(IServiceProvider services, CancellationToken cancellationToken) => CleanAsync(services, cancellationToken);
}
