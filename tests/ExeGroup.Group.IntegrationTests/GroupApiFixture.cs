using ExeGroup.Group.Repositories;
using ExeGroup.Group.Repositories.Data;
using ExeGroup.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.Group.IntegrationTests;

public sealed class GroupApiFixture : IAsyncLifetime
{
    public ServiceApiFactory<Program> Api { get; private set; } = null!;

    public string ConnectionString { get; private set; } = string.Empty;

    public async ValueTask InitializeAsync()
    {
        ConnectionString = (await SqlServerContainer.SharedAsync()).NewDatabaseConnectionString("group");
        Api = new ServiceApiFactory<Program>(DependencyInjection.ConnectionName, ConnectionString);
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

    public async ValueTask DisposeAsync()
    {
        await Api.DisposeAsync();
    }
}
