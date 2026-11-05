using ExeGroup.Identity.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Identity.Repositories.Data.Configurations;

public sealed class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.ToTable("RefreshTokens");
        builder.HasKey(token => token.RefreshTokenId).HasName("PK_RefreshTokens");
        builder.Property(token => token.TokenHash).HasMaxLength(64).IsFixedLength().IsUnicode(false).IsRequired();
        builder.Property(token => token.ExpiresAt).HasColumnType("datetime2");
        builder.Property(token => token.CreatedAt).HasColumnType("datetime2").HasDefaultValueSql("SYSUTCDATETIME()", "DF_RefreshTokens_CreatedAt");
        builder.Property(token => token.RevokedAt).HasColumnType("datetime2");
        builder.HasIndex(token => token.TokenHash).IsUnique().HasDatabaseName("UX_RefreshTokens_TokenHash");
        builder.HasIndex(token => token.UserId).HasDatabaseName("IX_RefreshTokens_UserId");
        builder.HasOne(token => token.User)
            .WithMany(user => user.RefreshTokens)
            .HasForeignKey(token => token.UserId)
            .HasConstraintName("FK_RefreshTokens_Users")
            .OnDelete(DeleteBehavior.Cascade);
    }
}
