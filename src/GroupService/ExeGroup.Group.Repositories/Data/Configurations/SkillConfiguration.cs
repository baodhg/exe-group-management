using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Group.Repositories.Data.Configurations;

public sealed class SkillConfiguration : IEntityTypeConfiguration<Skill>
{
    public void Configure(EntityTypeBuilder<Skill> builder)
    {
        builder.ToTable("Skills");
        builder.HasKey(skill => skill.SkillId).HasName("PK_Skills");
        builder.Property(skill => skill.Code).HasMaxLength(20).IsUnicode(false).IsRequired();
        builder.Property(skill => skill.Name).HasMaxLength(100).IsRequired();
        builder.HasIndex(skill => skill.Code).IsUnique().HasDatabaseName("UX_Skills_Code");
    }
}
