using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Group.Repositories.Data.Configurations;

public sealed class SemesterConfiguration : IEntityTypeConfiguration<Semester>
{
    public void Configure(EntityTypeBuilder<Semester> builder)
    {
        builder.ToTable("Semesters", table => table.HasCheckConstraint("CK_Semesters_Dates", "[EndDate] > [StartDate]"));
        builder.HasKey(semester => semester.SemesterId).HasName("PK_Semesters");
        builder.Property(semester => semester.Code).HasMaxLength(20).IsUnicode(false).IsRequired();
        builder.Property(semester => semester.Name).HasMaxLength(100).IsRequired();
        builder.Property(semester => semester.StartDate).HasColumnType("date");
        builder.Property(semester => semester.EndDate).HasColumnType("date");
        builder.HasIndex(semester => semester.Code).IsUnique().HasDatabaseName("UX_Semesters_Code");
    }
}
