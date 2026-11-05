using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Group.Repositories.Data.Configurations;

public sealed class CourseConfiguration : IEntityTypeConfiguration<Course>
{
    public void Configure(EntityTypeBuilder<Course> builder)
    {
        builder.ToTable("Courses", table =>
        {
            table.HasCheckConstraint("CK_Courses_GroupSize", "[MinGroupSize] >= 1 AND [MaxGroupSize] >= [MinGroupSize]");
            table.HasCheckConstraint("CK_Courses_RoomFactor", "[RoomFactor] >= 1.00");
            table.HasCheckConstraint("CK_Courses_Phase", "[Phase] IN ('Setup', 'Published', 'Expired', 'Finalized')");
            table.HasCheckConstraint("CK_Courses_Schedule", "[PublishAt] IS NULL OR [ExpireAt] IS NULL OR [ExpireAt] > [PublishAt]");
        });
        builder.HasKey(course => course.CourseId).HasName("PK_Courses");
        builder.HasAlternateKey(course => new { course.CourseId, course.SemesterId }).HasName("AK_Courses_CourseId_SemesterId");
        builder.Property(course => course.ClassCode).HasMaxLength(30).IsUnicode(false).IsRequired();
        builder.Property(course => course.LecturerName).HasMaxLength(150);
        builder.Property(course => course.MinGroupSize).HasDefaultValue(4, "DF_Courses_MinGroupSize");
        builder.Property(course => course.MaxGroupSize).HasDefaultValue(6, "DF_Courses_MaxGroupSize");
        builder.Property(course => course.RoomFactor).HasPrecision(3, 2).HasDefaultValue(1.20m, "DF_Courses_RoomFactor");
        builder.Property(course => course.Phase).HasMaxLength(20).IsUnicode(false).IsRequired().HasDefaultValue(CoursePhases.Setup, "DF_Courses_Phase");
        builder.Property(course => course.RowVersion).IsRowVersion();
        builder.HasIndex(course => new { course.SemesterId, course.SubjectId, course.ClassCode }).IsUnique().HasDatabaseName("UX_Courses_Semester_Subject_Class");
        builder.HasIndex(course => course.SubjectId).HasDatabaseName("IX_Courses_SubjectId");
        builder.HasIndex(course => course.LecturerId).HasFilter("[LecturerId] IS NOT NULL").HasDatabaseName("IX_Courses_LecturerId");
        builder.HasIndex(course => course.Phase).HasDatabaseName("IX_Courses_Phase");
        builder.HasOne<Semester>().WithMany().HasForeignKey(course => course.SemesterId)
            .HasConstraintName("FK_Courses_Semesters").OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<Subject>().WithMany().HasForeignKey(course => course.SubjectId)
            .HasConstraintName("FK_Courses_Subjects").OnDelete(DeleteBehavior.NoAction);
    }
}
