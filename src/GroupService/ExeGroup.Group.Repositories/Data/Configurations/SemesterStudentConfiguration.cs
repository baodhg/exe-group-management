using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Group.Repositories.Data.Configurations;

public sealed class SemesterStudentConfiguration : IEntityTypeConfiguration<SemesterStudent>
{
    public void Configure(EntityTypeBuilder<SemesterStudent> builder)
    {
        builder.ToTable("SemesterStudents");
        builder.HasKey(student => new { student.SemesterId, student.StudentId }).HasName("PK_SemesterStudents");
        builder.Property(student => student.StudentCode).HasMaxLength(20).IsUnicode(false).IsRequired();
        builder.Property(student => student.FullName).HasMaxLength(150).IsRequired();
        builder.Property(student => student.Email).HasMaxLength(255).IsRequired();
        builder.Property(student => student.AddedAt).HasDefaultValueSql("SYSUTCDATETIME()", "DF_SemesterStudents_AddedAt");
        builder.HasIndex(student => student.MajorId).HasDatabaseName("IX_SemesterStudents_MajorId");
        builder.HasOne<Semester>().WithMany().HasForeignKey(student => student.SemesterId)
            .HasConstraintName("FK_SemesterStudents_Semesters").OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<Major>().WithMany().HasForeignKey(student => student.MajorId)
            .HasConstraintName("FK_SemesterStudents_Majors").OnDelete(DeleteBehavior.NoAction);
        builder.HasMany(student => student.Skills).WithOne().HasForeignKey(skill => new { skill.SemesterId, skill.StudentId })
            .HasConstraintName("FK_StudentSkills_SemesterStudents").OnDelete(DeleteBehavior.NoAction);
    }
}
