using ExeGroup.Group.Repositories;
using ExeGroup.Testing;

namespace ExeGroup.Group.IntegrationTests;

public sealed class GroupApiFixture : IAsyncLifetime
{
    private readonly SqlServerContainer _sql = new();

    public ServiceApiFactory<Program> Api { get; private set; } = null!;

    public string ConnectionString { get; private set; } = string.Empty;

    public async ValueTask InitializeAsync()
    {
        await _sql.StartAsync();
        ConnectionString = _sql.NewDatabaseConnectionString("group");
        Api = new ServiceApiFactory<Program>(DependencyInjection.ConnectionName, ConnectionString);
        await Api.MigrateAsync();
    }

    public async ValueTask DisposeAsync()
    {
        await Api.DisposeAsync();
        await _sql.DisposeAsync();
    }
}
