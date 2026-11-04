using Microsoft.EntityFrameworkCore;

namespace ExeGroup.JoinRequest.Repositories.Data;

public sealed class JoinRequestDbContext(DbContextOptions<JoinRequestDbContext> options) : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(JoinRequestDbContext).Assembly);
    }
}
