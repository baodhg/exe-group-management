using ExeGroup.Group.Repositories;
using ExeGroup.Group.Repositories.Data;
using ExeGroup.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.Group.IntegrationTests;

public class GroupApiFixture : IAsyncLifetime
{
    public static readonly IReadOnlyDictionary<string, string?> Settings = new Dictionary<string, string?>
    {
        ["Jobs:OutboxPublisher:Enabled"] = "false",
    };

    public ServiceApiFactory<Program> Api { get; private set; } = null!;

    public string ConnectionString { get; private set; } = string.Empty;

    public virtual async ValueTask InitializeAsync()
    {
        ConnectionString = (await SqlServerContainer.SharedAsync()).NewDatabaseConnectionString("group");
        Api = new GroupApiFactory(ConnectionString, ConfigureServices);
        await Api.MigrateAsync();
    }

    public async Task SeedAsync(Action<GroupDbContext> seed, CancellationToken cancellationToken)
    {
        await using var scope = Api.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<GroupDbContext>();
        seed(database);
        await database.SaveChangesAsync(cancellationToken);
    }

    public async Task<T> QueryAsync<T>(Func<GroupDbContext, Task<T>> query)
    {
        await using var scope = Api.Services.CreateAsyncScope();
        return await query(scope.ServiceProvider.GetRequiredService<GroupDbContext>());
    }

    public virtual async ValueTask DisposeAsync()
    {
        await Api.DisposeAsync();
    }

    protected virtual void ConfigureServices(IServiceCollection services)
    {
    }

    private sealed class GroupApiFactory(string connectionString, Action<IServiceCollection> configureServices)
        : ServiceApiFactory<Program>(DependencyInjection.ConnectionName, connectionString, Settings)
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.ConfigureTestServices(configureServices);
        }
    }
}
