using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Group.Repositories.Data.Configurations;

public sealed class ProjectMilestoneConfiguration : IEntityTypeConfiguration<ProjectMilestone>
{
    public void Configure(EntityTypeBuilder<ProjectMilestone> builder)
    {
        builder.ToTable("ProjectMilestones", table =>
        {
            table.HasCheckConstraint("CK_ProjectMilestones_Weight", "[Weight] >= 1");
            table.HasCheckConstraint("CK_ProjectMilestones_Sequence", "[Sequence] >= 1");
        });
        builder.HasKey(milestone => milestone.MilestoneId).HasName("PK_ProjectMilestones");
        builder.Property(milestone => milestone.Name).HasMaxLength(100).IsRequired();
        builder.Property(milestone => milestone.Description).HasMaxLength(500);
        builder.Property(milestone => milestone.Weight).HasDefaultValue(1, "DF_ProjectMilestones_Weight");
        builder.Property(milestone => milestone.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()", "DF_ProjectMilestones_CreatedAt");
        builder.Property(milestone => milestone.RowVersion).IsRowVersion();
        builder.HasIndex(milestone => new { milestone.CourseId, milestone.Name }).IsUnique().HasDatabaseName("UX_ProjectMilestones_Course_Name");
        builder.HasIndex(milestone => new { milestone.CourseId, milestone.Sequence }).IsUnique().HasDatabaseName("UX_ProjectMilestones_Course_Sequence");
        builder.HasOne<Course>().WithMany()
            .HasForeignKey(milestone => milestone.CourseId)
            .HasPrincipalKey(course => course.CourseId)
            .HasConstraintName("FK_ProjectMilestones_Courses").OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class ProjectDeliverableConfiguration : IEntityTypeConfiguration<ProjectDeliverable>
{
    public void Configure(EntityTypeBuilder<ProjectDeliverable> builder)
    {
        builder.ToTable("ProjectDeliverables", table =>
        {
            table.HasCheckConstraint("CK_ProjectDeliverables_Status", "[Status] IN ('NotStarted', 'InProgress', 'Submitted', 'Approved', 'ChangesRequested')");
            table.HasCheckConstraint("CK_ProjectDeliverables_Score", "[Score] IS NULL OR ([Score] >= 0 AND [Score] <= 10)");
        });
        builder.HasKey(deliverable => deliverable.DeliverableId).HasName("PK_ProjectDeliverables");
        builder.Property(deliverable => deliverable.Title).HasMaxLength(150).IsRequired();
        builder.Property(deliverable => deliverable.Notes).HasMaxLength(1000);
        builder.Property(deliverable => deliverable.Status).HasMaxLength(20).IsUnicode(false).IsRequired().HasDefaultValue(DeliverableStatuses.NotStarted, "DF_ProjectDeliverables_Status");
        builder.Property(deliverable => deliverable.ReviewNote).HasMaxLength(500);
        builder.Property(deliverable => deliverable.Score).HasPrecision(5, 2);
        builder.Property(deliverable => deliverable.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()", "DF_ProjectDeliverables_CreatedAt");
        builder.Property(deliverable => deliverable.RowVersion).IsRowVersion();
        builder.HasIndex(deliverable => new { deliverable.MilestoneId, deliverable.RoomId }).IsUnique().HasDatabaseName("UX_ProjectDeliverables_Milestone_Room");
        builder.HasIndex(deliverable => new { deliverable.CourseId, deliverable.RoomId }).HasDatabaseName("IX_ProjectDeliverables_Course_Room");
        builder.HasIndex(deliverable => new { deliverable.MilestoneId, deliverable.Status }).HasDatabaseName("IX_ProjectDeliverables_Milestone_Status");
        builder.HasOne<ProjectMilestone>().WithMany()
            .HasForeignKey(deliverable => deliverable.MilestoneId)
            .HasPrincipalKey(milestone => milestone.MilestoneId)
            .HasConstraintName("FK_ProjectDeliverables_Milestones").OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<Room>().WithMany()
            .HasForeignKey(deliverable => new { deliverable.RoomId, deliverable.CourseId })
            .HasPrincipalKey(room => new { room.RoomId, room.CourseId })
            .HasConstraintName("FK_ProjectDeliverables_Rooms").OnDelete(DeleteBehavior.NoAction);
    }
}
