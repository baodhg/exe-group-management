using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ExeGroup.BuildingBlocks.Data;

public abstract class SqlServerDesignTimeFactory<TContext>(
    string connectionName,
    Func<DbContextOptions<TContext>, TContext> create)
    : IDesignTimeDbContextFactory<TContext>
    where TContext : DbContext
{
    public TContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable($"ConnectionStrings__{connectionName}")
            ?? $"Server=localhost,14330;Database={connectionName};User Id=sa;Password=design-time-only;TrustServerCertificate=True";
        var builder = new DbContextOptionsBuilder<TContext>();
        SqlServerRegistration.ConfigureSqlServer(builder, connectionString);
        return create(builder.Options);
    }
}
