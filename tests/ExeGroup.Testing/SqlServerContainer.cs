using Microsoft.Data.SqlClient;
using Testcontainers.MsSql;

namespace ExeGroup.Testing;

public sealed class SqlServerContainer : IAsyncDisposable
{
    private static readonly Lazy<Task<SqlServerContainer>> SharedContainer = new(StartSharedAsync);

    private readonly MsSqlContainer _container = new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-latest").Build();

    public static Task<SqlServerContainer> SharedAsync() => SharedContainer.Value;

    public async Task StartAsync(CancellationToken cancellationToken = default) => await _container.StartAsync(cancellationToken);

    public string ConnectionStringFor(string database) =>
        new SqlConnectionStringBuilder(_container.GetConnectionString()) { InitialCatalog = database }.ConnectionString;

    public string NewDatabaseConnectionString(string prefix) => ConnectionStringFor($"{prefix}_{Guid.NewGuid():N}");

    public async ValueTask DisposeAsync() => await _container.DisposeAsync();

    private static async Task<SqlServerContainer> StartSharedAsync()
    {
        var container = new SqlServerContainer();
        await container.StartAsync();
        return container;
    }
}
