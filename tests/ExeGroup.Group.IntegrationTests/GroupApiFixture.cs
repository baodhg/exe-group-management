using ExeGroup.Group.Repositories;
using ExeGroup.Testing;

namespace ExeGroup.Group.IntegrationTests;

public sealed class GroupApiFixture : IAsyncLifetime
{
    private readonly SqlServerContainer _sql = new();

    public ServiceApiFactory<Program> Api { get; private set; } = null!;

    public async ValueTask InitializeAsync()
    {
        await _sql.StartAsync();
        Api = new ServiceApiFactory<Program>(
            DependencyInjection.ConnectionName,
            _sql.NewDatabaseConnectionString("group"));
        await Api.MigrateAsync();
    }

    public async ValueTask DisposeAsync()
    {
        await Api.DisposeAsync();
        await _sql.DisposeAsync();
    }
}
