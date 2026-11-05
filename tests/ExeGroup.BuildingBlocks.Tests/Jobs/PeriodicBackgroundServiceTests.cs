using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Jobs;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace ExeGroup.BuildingBlocks.Tests.Jobs;

public sealed class PeriodicBackgroundServiceTests
{
    [Fact]
    public async Task A_failing_tick_does_not_stop_the_next_ones()
    {
        var job = new FlakyJob(BuildScopes());

        await job.StartAsync(TestContext.Current.CancellationToken);
        await job.ReachedThirdTick.Task.WaitAsync(TimeSpan.FromSeconds(5), TestContext.Current.CancellationToken);
        await job.StopAsync(TestContext.Current.CancellationToken);

        Assert.True(job.Ticks >= 3);
    }

    [Fact]
    public async Task Each_tick_runs_in_its_own_scope_with_a_correlation_id()
    {
        var job = new FlakyJob(BuildScopes());

        await job.StartAsync(TestContext.Current.CancellationToken);
        await job.ReachedThirdTick.Task.WaitAsync(TimeSpan.FromSeconds(5), TestContext.Current.CancellationToken);
        await job.StopAsync(TestContext.Current.CancellationToken);

        Assert.Equal(job.Ticks, job.Scopes.Distinct().Count());
        Assert.All(job.CorrelationIds, id => Assert.StartsWith("job-flaky-", id));
    }

    private static IServiceScopeFactory BuildScopes() =>
        new ServiceCollection()
            .AddScoped<ScopeMarker>()
            .AddSingleton<ICorrelationContext, CorrelationContext>()
            .BuildServiceProvider()
            .GetRequiredService<IServiceScopeFactory>();

    private sealed class ScopeMarker;

    private sealed class FlakyJob(IServiceScopeFactory scopes)
        : PeriodicBackgroundService(scopes, NullLogger<FlakyJob>.Instance)
    {
        public int Ticks;

        public List<ScopeMarker> Scopes { get; } = [];

        public List<string?> CorrelationIds { get; } = [];

        public TaskCompletionSource ReachedThirdTick { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

        protected override string JobName => "flaky";

        protected override TimeSpan Interval => TimeSpan.FromMilliseconds(20);

        protected override Task RunOnceAsync(IServiceProvider services, CancellationToken cancellationToken)
        {
            var tick = Interlocked.Increment(ref Ticks);
            lock (Scopes)
            {
                Scopes.Add(services.GetRequiredService<ScopeMarker>());
                CorrelationIds.Add(services.GetRequiredService<ICorrelationContext>().CorrelationId);
            }

            if (tick == 3)
            {
                ReachedThirdTick.TrySetResult();
            }

            return tick == 1 ? throw new InvalidOperationException("first tick fails") : Task.CompletedTask;
        }
    }
}
