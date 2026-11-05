using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Realtime.Repositories.Interfaces;

namespace ExeGroup.Realtime.Services.Events;

public interface IProcessedEventCleaner
{
    Task<int> DeleteOlderThanAsync(TimeSpan age, CancellationToken cancellationToken);
}

public sealed class ProcessedEventCleaner(IGroupEventRepository events, IClock clock) : IProcessedEventCleaner
{
    public Task<int> DeleteOlderThanAsync(TimeSpan age, CancellationToken cancellationToken) =>
        events.DeleteProcessedBeforeAsync(clock.UtcNow - age, cancellationToken);
}
