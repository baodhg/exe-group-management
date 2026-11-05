using Microsoft.EntityFrameworkCore;

namespace ExeGroup.BuildingBlocks.Data;

public interface ITransactionRunner
{
    Task ExecuteAsync(Func<CancellationToken, Task> work, CancellationToken cancellationToken = default);

    Task<TResult> ExecuteAsync<TResult>(Func<CancellationToken, Task<TResult>> work, CancellationToken cancellationToken = default);

    Task<TResult> ExecuteWithConflictRetryAsync<TResult>(Func<CancellationToken, Task<TResult>> work, CancellationToken cancellationToken = default);
}

internal sealed class DbContextTransactionRunner<TContext>(TContext context) : ITransactionRunner
    where TContext : DbContext
{
    public Task ExecuteAsync(Func<CancellationToken, Task> work, CancellationToken cancellationToken = default) =>
        context.ExecuteInTransactionAsync(work, cancellationToken);

    public const int ConflictAttempts = 3;

    public Task<TResult> ExecuteAsync<TResult>(Func<CancellationToken, Task<TResult>> work, CancellationToken cancellationToken = default) =>
        context.ExecuteInTransactionAsync(work, cancellationToken);

    public async Task<TResult> ExecuteWithConflictRetryAsync<TResult>(Func<CancellationToken, Task<TResult>> work, CancellationToken cancellationToken = default)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return await context.ExecuteInTransactionAsync(work, cancellationToken);
            }
            catch (DbUpdateException exception) when (attempt < ConflictAttempts && (exception is DbUpdateConcurrencyException || exception.IsUniqueViolation()))
            {
                context.ChangeTracker.Clear();
            }
        }
    }
}
