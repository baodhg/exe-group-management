using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Group.Repositories.Data.Configurations;

public sealed class SubjectConfiguration : IEntityTypeConfiguration<Subject>
{
    public void Configure(EntityTypeBuilder<Subject> builder)
    {
        builder.ToTable("Subjects");
        builder.HasKey(subject => subject.SubjectId).HasName("PK_Subjects");
        builder.Property(subject => subject.Code).HasMaxLength(20).IsUnicode(false).IsRequired();
        builder.Property(subject => subject.Name).HasMaxLength(150).IsRequired();
        builder.HasIndex(subject => subject.Code).IsUnique().HasDatabaseName("UX_Subjects_Code");
    }
}
