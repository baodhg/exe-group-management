using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace ExeGroup.BuildingBlocks.Data;

public static class SqlServerRegistration
{
    public static IServiceCollection AddSqlServerDatabase<TContext>(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionName)
        where TContext : DbContext
    {
        var connectionString = configuration.GetConnectionString(connectionName);
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                $"Connection string '{connectionName}' is missing. Set ConnectionStrings__{connectionName}.");
        }

        services.AddDbContext<TContext>(options => ConfigureSqlServer(options, connectionString));
        services.AddScoped<ITransactionRunner, DbContextTransactionRunner<TContext>>();
        services.AddSingleton<IDatabaseMigrator, DatabaseMigrator<TContext>>();
        services.AddHealthChecks().AddDbContextCheck<TContext>(connectionName, HealthStatus.Unhealthy, [HealthTags.Ready]);

        return services;
    }

    public static DbContextOptionsBuilder ConfigureSqlServer(DbContextOptionsBuilder options, string connectionString) =>
        options.UseSqlServer(
            connectionString,
            sql => sql.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(10), errorNumbersToAdd: null));
}
