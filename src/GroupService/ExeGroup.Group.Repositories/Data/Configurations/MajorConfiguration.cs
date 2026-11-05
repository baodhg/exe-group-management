using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Group.Repositories.Data.Configurations;

public sealed class MajorConfiguration : IEntityTypeConfiguration<Major>
{
    public void Configure(EntityTypeBuilder<Major> builder)
    {
        builder.ToTable("Majors");
        builder.HasKey(major => major.MajorId).HasName("PK_Majors");
        builder.Property(major => major.Code).HasMaxLength(10).IsUnicode(false).IsRequired();
        builder.Property(major => major.Name).HasMaxLength(100).IsRequired();
        builder.HasIndex(major => major.Code).IsUnique().HasDatabaseName("UX_Majors_Code");
    }
}
