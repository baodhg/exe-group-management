using ExeGroup.BuildingBlocks.Web.Jobs;
using ExeGroup.Group.Services.Courses;

namespace ExeGroup.Group.API.Jobs;

public sealed record PhaseRun(int Published, int Expired, int Failed);

public sealed class PhaseScheduler : PeriodicBackgroundService
{
    public const string EnabledKey = "Jobs:PhaseScheduler:Enabled";

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<PhaseScheduler> _logger;

    public PhaseScheduler(IServiceScopeFactory scopes, ILogger<PhaseScheduler> logger)
        : base(scopes, logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override string JobName => nameof(PhaseScheduler);

    protected override TimeSpan Interval => TimeSpan.FromMinutes(1);

    public async Task<PhaseRun> RunDueChangesAsync(CancellationToken cancellationToken)
    {
        DuePhaseChanges due;
        await using (var scope = _scopes.CreateAsyncScope())
        {
            due = await scope.ServiceProvider.GetRequiredService<ICoursePhaseService>().ListDueAsync(cancellationToken);
        }

        var (published, failedPublish) = await RunEachAsync(due.ToPublish, "publish", (phases, courseId, token) => phases.PublishAsync(courseId, token), cancellationToken);
        var (expired, failedExpire) = await RunEachAsync(due.ToExpire, "expire", (phases, courseId, token) => phases.ExpireAsync(courseId, token), cancellationToken);
        var run = new PhaseRun(published, expired, failedPublish + failedExpire);
        if (due.ToPublish.Count + due.ToExpire.Count > 0)
        {
            _logger.LogInformation(
                "Phase scheduler published {Published} and expired {Expired} courses; {Failed} failed",
                run.Published,
                run.Expired,
                run.Failed);
        }

        return run;
    }

    protected override Task RunOnceAsync(IServiceProvider services, CancellationToken cancellationToken) => RunDueChangesAsync(cancellationToken);

    private async Task<(int Done, int Failed)> RunEachAsync(
        IReadOnlyList<Guid> courseIds,
        string action,
        Func<ICoursePhaseService, Guid, CancellationToken, Task> change,
        CancellationToken cancellationToken)
    {
        var (done, failed) = (0, 0);
        foreach (var courseId in courseIds)
        {
            await using var scope = _scopes.CreateAsyncScope();
            try
            {
                await change(scope.ServiceProvider.GetRequiredService<ICoursePhaseService>(), courseId, cancellationToken);
                done++;
            }
            catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
            {
                failed++;
                _logger.LogWarning(exception, "Phase scheduler could not {Action} course {CourseId}", action, courseId);
            }
        }

        return (done, failed);
    }
}
