using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Group.Repositories.Data.Configurations;

public sealed class CourseEnrollmentConfiguration : IEntityTypeConfiguration<CourseEnrollment>
{
    public void Configure(EntityTypeBuilder<CourseEnrollment> builder)
    {
        builder.ToTable("CourseEnrollments");
        builder.HasKey(enrollment => new { enrollment.CourseId, enrollment.StudentId }).HasName("PK_CourseEnrollments");
        builder.Property(enrollment => enrollment.EnrolledAt).HasDefaultValueSql("SYSUTCDATETIME()", "DF_CourseEnrollments_EnrolledAt");
        builder.HasIndex(enrollment => new { enrollment.SemesterId, enrollment.StudentId }).HasDatabaseName("IX_CourseEnrollments_Semester_Student");
        builder.HasOne<Course>().WithMany()
            .HasForeignKey(enrollment => new { enrollment.CourseId, enrollment.SemesterId })
            .HasPrincipalKey(course => new { course.CourseId, course.SemesterId })
            .HasConstraintName("FK_CourseEnrollments_Courses").OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<SemesterStudent>().WithMany()
            .HasForeignKey(enrollment => new { enrollment.SemesterId, enrollment.StudentId })
            .HasConstraintName("FK_CourseEnrollments_SemesterStudents").OnDelete(DeleteBehavior.NoAction);
    }
}
