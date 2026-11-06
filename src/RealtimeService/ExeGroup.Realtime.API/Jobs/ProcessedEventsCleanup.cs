using ExeGroup.BuildingBlocks.Web.Jobs;
using ExeGroup.Realtime.Services.Events;

namespace ExeGroup.Realtime.API.Jobs;

public sealed class ProcessedEventsCleanup(IServiceScopeFactory scopes, IConfiguration configuration, ILogger<ProcessedEventsCleanup> logger)
    : PeriodicBackgroundService(scopes, logger)
{
    public const string EnabledKey = "Jobs:ProcessedEventsCleanup:Enabled";
    public const string RetentionDaysKey = "Jobs:ProcessedEventsCleanup:RetentionDays";
    public const int DefaultRetentionDays = 7;

    protected override string JobName => nameof(ProcessedEventsCleanup);

    protected override TimeSpan Interval => TimeSpan.FromDays(1);

    public int RetentionDays => Math.Max(1, configuration.GetValue(RetentionDaysKey, DefaultRetentionDays));

    public async Task<int> CleanAsync(IServiceProvider services, CancellationToken cancellationToken)
    {
        var deleted = await services.GetRequiredService<IProcessedEventCleaner>().DeleteOlderThanAsync(TimeSpan.FromDays(RetentionDays), cancellationToken);
        logger.LogInformation("Deleted {Count} processed group events older than {Days} days", deleted, RetentionDays);
        return deleted;
    }

    protected override Task RunOnceAsync(IServiceProvider services, CancellationToken cancellationToken) => CleanAsync(services, cancellationToken);
}
