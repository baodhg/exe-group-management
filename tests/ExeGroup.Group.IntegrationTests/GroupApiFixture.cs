using ExeGroup.Group.Repositories;
using ExeGroup.Testing;

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

    public async ValueTask DisposeAsync()
    {
        await Api.DisposeAsync();
    }
}
