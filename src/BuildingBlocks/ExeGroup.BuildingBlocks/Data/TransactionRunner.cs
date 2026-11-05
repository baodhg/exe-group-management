using Microsoft.EntityFrameworkCore;

namespace ExeGroup.BuildingBlocks.Data;

public interface ITransactionRunner
{
    Task ExecuteAsync(Func<CancellationToken, Task> work, CancellationToken cancellationToken = default);

    Task<TResult> ExecuteAsync<TResult>(Func<CancellationToken, Task<TResult>> work, CancellationToken cancellationToken = default);
}

internal sealed class DbContextTransactionRunner<TContext>(TContext context) : ITransactionRunner
    where TContext : DbContext
{
    public Task ExecuteAsync(Func<CancellationToken, Task> work, CancellationToken cancellationToken = default) =>
        context.ExecuteInTransactionAsync(work, cancellationToken);

    public Task<TResult> ExecuteAsync<TResult>(Func<CancellationToken, Task<TResult>> work, CancellationToken cancellationToken = default) =>
        context.ExecuteInTransactionAsync(work, cancellationToken);
}
