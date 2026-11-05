using ExeGroup.BuildingBlocks.Data;
using ExeGroup.Testing;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.BuildingBlocks.Tests.Data;

public sealed class SqlServerFixture : IAsyncLifetime
{
    private readonly SqlServerContainer _sql = new();

    public async ValueTask InitializeAsync() => await _sql.StartAsync();

    public async ValueTask DisposeAsync() => await _sql.DisposeAsync();

    public async Task<ProbeDbContext> NewDatabaseAsync()
    {
        var builder = new DbContextOptionsBuilder<ProbeDbContext>();
        SqlServerRegistration.ConfigureSqlServer(builder, _sql.NewDatabaseConnectionString("probe"));
        var context = new ProbeDbContext(builder.Options);
        await context.Database.EnsureCreatedAsync();
        return context;
    }
}

[CollectionDefinition(Name)]
public sealed class SqlServerCollection : ICollectionFixture<SqlServerFixture>
{
    public const string Name = "sql-server";
}

public sealed class ProbeGroup
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Code { get; set; } = string.Empty;

    public int Members { get; set; }
}

public sealed class ProbeMember
{
    public Guid Id { get; set; }

    public Guid GroupId { get; set; }
}

public sealed class ProbeDbContext(DbContextOptions<ProbeDbContext> options) : DbContext(options)
{
    public DbSet<ProbeGroup> Groups => Set<ProbeGroup>();

    public DbSet<ProbeMember> Members => Set<ProbeMember>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ProbeGroup>().HasIndex(group => group.Code).IsUnique();
        modelBuilder.Entity<ProbeGroup>().Property(group => group.Code).HasMaxLength(20);
        modelBuilder.Entity<ProbeMember>().HasOne<ProbeGroup>().WithMany().HasForeignKey(member => member.GroupId);
    }
}
