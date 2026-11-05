using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace ExeGroup.BuildingBlocks.Web.Hosting;

public sealed class DatabaseReadiness
{
    private readonly TaskCompletionSource _ready = new(TaskCreationOptions.RunContinuationsAsynchronously);

    public bool IsReady => _ready.Task.IsCompleted;

    public Task WhenReady => _ready.Task;

    public void MarkReady() => _ready.TrySetResult();
}

public sealed class DatabaseReadinessCheck(DatabaseReadiness readiness) : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default) =>
        Task.FromResult(readiness.IsReady
            ? HealthCheckResult.Healthy("Database migrations are applied.")
            : HealthCheckResult.Unhealthy("Database migrations are still running."));
}
