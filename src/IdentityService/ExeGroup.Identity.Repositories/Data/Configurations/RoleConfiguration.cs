using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Identity.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Identity.Repositories.Data.Configurations;

public sealed class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.ToTable("Roles");
        builder.HasKey(role => role.RoleId).HasName("PK_Roles");
        builder.Property(role => role.Name).HasMaxLength(50).IsUnicode(false).IsRequired();
        builder.HasIndex(role => role.Name).IsUnique().HasDatabaseName("UX_Roles_Name");
        builder.HasData(
            new Role { RoleId = Role.StudentId, Name = Roles.Student },
            new Role { RoleId = Role.LecturerId, Name = Roles.Lecturer },
            new Role { RoleId = Role.AdministratorId, Name = Roles.Administrator });
    }
}
