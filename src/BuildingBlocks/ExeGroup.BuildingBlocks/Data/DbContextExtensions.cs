using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.BuildingBlocks.Data;

public static class DbContextExtensions
{
    public static Task ExecuteInTransactionAsync(
        this DbContext context,
        Func<CancellationToken, Task> work,
        CancellationToken cancellationToken = default) =>
        context.ExecuteInTransactionAsync<object?>(
            async token =>
            {
                await work(token);
                return null;
            },
            cancellationToken);

    public static Task<TResult> ExecuteInTransactionAsync<TResult>(
        this DbContext context,
        Func<CancellationToken, Task<TResult>> work,
        CancellationToken cancellationToken = default)
    {
        var strategy = context.Database.CreateExecutionStrategy();
        return strategy.ExecuteAsync(
            (context, work),
            async (_, state, token) =>
            {
                await using var transaction = await state.context.Database.BeginTransactionAsync(token);
                var result = await state.work(token);
                await transaction.CommitAsync(token);
                return result;
            },
            null,
            cancellationToken);
    }

    public static bool IsUniqueViolation(this DbUpdateException exception) =>
        exception.InnerException is SqlException { Number: 2601 or 2627 };
}
