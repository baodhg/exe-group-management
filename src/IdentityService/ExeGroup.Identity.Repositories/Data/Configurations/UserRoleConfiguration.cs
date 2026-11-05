using ExeGroup.Identity.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Identity.Repositories.Data.Configurations;

public sealed class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> builder)
    {
        builder.ToTable("UserRoles");
        builder.HasKey(userRole => new { userRole.UserId, userRole.RoleId }).HasName("PK_UserRoles");
        builder.HasIndex(userRole => userRole.RoleId).HasDatabaseName("IX_UserRoles_RoleId");
        builder.HasOne(userRole => userRole.User)
            .WithMany(user => user.UserRoles)
            .HasForeignKey(userRole => userRole.UserId)
            .HasConstraintName("FK_UserRoles_Users")
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(userRole => userRole.Role)
            .WithMany(role => role.UserRoles)
            .HasForeignKey(userRole => userRole.RoleId)
            .HasConstraintName("FK_UserRoles_Roles")
            .OnDelete(DeleteBehavior.NoAction);
    }
}
