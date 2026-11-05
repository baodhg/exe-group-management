using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Group.Repositories.Data.Configurations;

public sealed class JoinRequestConfiguration : IEntityTypeConfiguration<JoinRequest>
{
    public void Configure(EntityTypeBuilder<JoinRequest> builder)
    {
        builder.ToTable("JoinRequests", table =>
        {
            table.HasCheckConstraint("CK_JoinRequests_Status", "[Status] IN ('Pending', 'Approved', 'Rejected', 'Cancelled')");
            table.HasCheckConstraint(
                "CK_JoinRequests_ReasonCode",
                "[ReasonCode] IS NULL OR [ReasonCode] IN ('REJECTED_BY_LEADER', 'WITHDRAWN', 'ROOM_FULL', 'ROOM_REOPENED', 'COMPOSITION_RULE', 'JOINED_ANOTHER_ROOM', 'GROUPING_EXPIRED')");
        });
        builder.HasKey(request => request.RequestId).HasName("PK_JoinRequests");
        builder.Property(request => request.Message).HasMaxLength(500);
        builder.Property(request => request.Status).HasMaxLength(20).IsUnicode(false).IsRequired().HasDefaultValue(JoinRequestStatuses.Pending, "DF_JoinRequests_Status");
        builder.Property(request => request.ReasonCode).HasMaxLength(40).IsUnicode(false);
        builder.Property(request => request.ReasonText).HasMaxLength(500);
        builder.Property(request => request.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()", "DF_JoinRequests_CreatedAt");
        builder.Property(request => request.RowVersion).IsRowVersion();
        builder.HasIndex(request => new { request.RoomId, request.StudentId }).IsUnique().HasFilter("[Status] = 'Pending'").HasDatabaseName("UX_JoinRequests_Pending");
        builder.HasIndex(request => new { request.CourseId, request.StudentId, request.Status }).HasDatabaseName("IX_JoinRequests_Course_Student_Status");
        builder.HasIndex(request => new { request.RoomId, request.Status }).HasDatabaseName("IX_JoinRequests_Room_Status");
        builder.HasOne<Room>().WithMany()
            .HasForeignKey(request => new { request.RoomId, request.CourseId })
            .HasPrincipalKey(room => new { room.RoomId, room.CourseId })
            .HasConstraintName("FK_JoinRequests_Rooms").OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<CourseEnrollment>().WithMany()
            .HasForeignKey(request => new { request.CourseId, request.StudentId })
            .HasConstraintName("FK_JoinRequests_CourseEnrollments").OnDelete(DeleteBehavior.NoAction);
    }
}
