using ExeGroup.BuildingBlocks.Data;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ExeGroup.BuildingBlocks.Web.Hosting;

public static class DatabaseStartup
{
    public const string MigrateOnStartupKey = "Database:MigrateOnStartup";
    private const int Attempts = 6;
    private static readonly TimeSpan Delay = TimeSpan.FromSeconds(5);

    public static async Task RunWithDatabaseMigrationsAsync(this WebApplication app)
    {
        await app.StartAsync();
        await app.MigrateDatabasesAsync();
        await app.WaitForShutdownAsync();
    }

    public static async Task MigrateDatabasesAsync(this WebApplication app)
    {
        var enabled = app.Configuration.GetValue<bool?>(MigrateOnStartupKey) ?? app.Environment.IsDevelopment();
        var migrators = app.Services.GetServices<IDatabaseMigrator>().ToList();
        var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger(nameof(DatabaseStartup));
        if (!enabled || migrators.Count == 0)
        {
            return;
        }

        foreach (var migrator in migrators)
        {
            for (var attempt = 1; ; attempt++)
            {
                try
                {
                    await migrator.MigrateAsync(app.Lifetime.ApplicationStopping);
                    logger.LogInformation("Database {Database} is migrated (attempt {Attempt})", migrator.Name, attempt);
                    break;
                }
                catch (Exception exception) when (attempt < Attempts && !app.Lifetime.ApplicationStopping.IsCancellationRequested)
                {
                    logger.LogWarning("Database {Database} is not ready (attempt {Attempt}/{Attempts}): {Reason}", migrator.Name, attempt, Attempts, exception.Message);
                    await Task.Delay(Delay, app.Lifetime.ApplicationStopping);
                }
            }
        }
    }
}
