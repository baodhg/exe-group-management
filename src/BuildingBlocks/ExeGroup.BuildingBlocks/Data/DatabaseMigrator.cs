using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.BuildingBlocks.Data;

public interface IDatabaseMigrator
{
    string Name { get; }

    Task MigrateAsync(CancellationToken cancellationToken);
}

public sealed class DatabaseMigrator<TContext>(IServiceScopeFactory scopes) : IDatabaseMigrator
    where TContext : DbContext
{
    public string Name => typeof(TContext).Name;

    public async Task MigrateAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopes.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<TContext>();
        await context.Database.MigrateAsync(cancellationToken);
    }
}
