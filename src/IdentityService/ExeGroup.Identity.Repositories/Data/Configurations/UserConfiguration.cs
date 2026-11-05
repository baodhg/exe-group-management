using ExeGroup.Identity.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Identity.Repositories.Data.Configurations;

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users", table => table.HasCheckConstraint("CK_Users_Status", "[Status] IN ('Active', 'Locked')"));
        builder.HasKey(user => user.UserId).HasName("PK_Users");
        builder.Property(user => user.Email).HasMaxLength(255).IsRequired();
        builder.Property(user => user.UserCode).HasMaxLength(20).IsUnicode(false);
        builder.Property(user => user.PasswordHash).HasMaxLength(500).IsRequired();
        builder.Property(user => user.FullName).HasMaxLength(150).IsRequired();
        builder.Property(user => user.Status).HasMaxLength(20).IsUnicode(false).IsRequired().HasDefaultValue(UserStatuses.Active, "DF_Users_Status");
        builder.Property(user => user.CreatedAt).HasColumnType("datetime2").HasDefaultValueSql("SYSUTCDATETIME()", "DF_Users_CreatedAt");
        builder.Property(user => user.UpdatedAt).HasColumnType("datetime2");
        builder.HasIndex(user => user.Email).IsUnique().HasDatabaseName("UX_Users_Email");
        builder.HasIndex(user => user.UserCode).IsUnique().HasFilter("[UserCode] IS NOT NULL").HasDatabaseName("UX_Users_UserCode");
    }
}
