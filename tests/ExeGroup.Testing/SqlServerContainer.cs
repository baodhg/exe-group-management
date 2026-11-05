using Microsoft.Data.SqlClient;
using Testcontainers.MsSql;

namespace ExeGroup.Testing;

public sealed class SqlServerContainer : IAsyncDisposable
{
    private readonly MsSqlContainer _container = new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-latest").Build();

    public async Task StartAsync(CancellationToken cancellationToken = default) => await _container.StartAsync(cancellationToken);

    public string ConnectionStringFor(string database) =>
        new SqlConnectionStringBuilder(_container.GetConnectionString()) { InitialCatalog = database }.ConnectionString;

    public string NewDatabaseConnectionString(string prefix) => ConnectionStringFor($"{prefix}_{Guid.NewGuid():N}");

    public async ValueTask DisposeAsync() => await _container.DisposeAsync();
}
