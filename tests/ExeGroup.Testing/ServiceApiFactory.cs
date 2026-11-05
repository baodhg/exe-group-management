using System.Net.Http.Headers;
using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Web.Hosting;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.Testing;

public class ServiceApiFactory<TProgram>(
    string connectionName,
    string connectionString,
    IReadOnlyDictionary<string, string?>? extraSettings = null)
    : WebApplicationFactory<TProgram>
    where TProgram : class
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        foreach (var (key, value) in TestTokens.Configuration)
        {
            builder.UseSetting(key, value);
        }

        builder.UseSetting($"ConnectionStrings:{connectionName}", connectionString);
        builder.UseSetting("Database:MigrateOnStartup", "false");
        builder.UseSetting("Redis:Connection", "localhost:1,abortConnect=false");
        foreach (var (key, value) in extraSettings ?? new Dictionary<string, string?>())
        {
            builder.UseSetting(key, value);
        }
    }

    public async Task MigrateAsync(CancellationToken cancellationToken = default)
    {
        foreach (var migrator in Services.GetServices<IDatabaseMigrator>())
        {
            await migrator.MigrateAsync(cancellationToken);
        }

        Services.GetService<DatabaseReadiness>()?.MarkReady();
    }

    public HttpClient ClientAs(string role, Guid? userId = null)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestTokens.For(userId ?? Guid.NewGuid(), role));
        return client;
    }

    public HttpClient AnonymousClient() => CreateClient();
}
