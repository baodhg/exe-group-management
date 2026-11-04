using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ExeGroup.BuildingBlocks.Web.Observability;

namespace ExeGroup.BuildingBlocks.Web.Jobs;

public abstract class PeriodicBackgroundService(IServiceScopeFactory scopes, ILogger logger) : BackgroundService
{
    protected abstract string JobName { get; }

    protected abstract TimeSpan Interval { get; }

    protected abstract Task RunOnceAsync(IServiceProvider services, CancellationToken cancellationToken);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await WaitForDatabaseAsync(stoppingToken);
        logger.LogInformation("Job {Job} started, every {Interval}", JobName, Interval);
        using var timer = new PeriodicTimer(Interval);
        try
        {
            do
            {
                await RunTickAsync(stoppingToken);
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            logger.LogInformation("Job {Job} stopped", JobName);
        }
    }

    private async Task WaitForDatabaseAsync(CancellationToken stoppingToken)
    {
        await using var scope = scopes.CreateAsyncScope();
        var readiness = scope.ServiceProvider.GetService<DatabaseReadiness>();
        if (readiness is not null)
        {
            await readiness.WhenReady.WaitAsync(stoppingToken);
        }
    }

    private async Task RunTickAsync(CancellationToken stoppingToken)
    {
        await using var scope = scopes.CreateAsyncScope();
        var correlationId = $"job-{JobName}-{CorrelationContext.NewId()[..12]}";
        var correlation = scope.ServiceProvider.GetService<ICorrelationContext>() ?? new CorrelationContext();

        using (CorrelationScope.Begin(correlation, correlationId))
        {
            try
            {
                await RunOnceAsync(scope.ServiceProvider, stoppingToken);
            }
            catch (Exception exception) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(exception, "Job {Job} failed this run; it will run again in {Interval}", JobName, Interval);
            }
        }
    }
}
