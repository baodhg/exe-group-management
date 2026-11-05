using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Group.Repositories.Data;

public sealed class GroupDbContext(DbContextOptions<GroupDbContext> options) : DbContext(options)
{
    public DbSet<Semester> Semesters => Set<Semester>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(GroupDbContext).Assembly);
    }
}
