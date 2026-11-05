using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Group.Repositories.Data.Configurations;

public sealed class RoomMemberConfiguration : IEntityTypeConfiguration<RoomMember>
{
    public void Configure(EntityTypeBuilder<RoomMember> builder)
    {
        builder.ToTable("RoomMembers", table =>
        {
            table.HasCheckConstraint("CK_RoomMembers_JoinedVia", "[JoinedVia] IN ('Open', 'Application', 'Admin')");
            table.HasCheckConstraint("CK_RoomMembers_End", "([EndedAt] IS NULL AND [EndReason] IS NULL) OR ([EndedAt] IS NOT NULL AND [EndReason] IN ('Left', 'Removed', 'Moved'))");
            table.HasCheckConstraint("CK_RoomMembers_RemovedNote", "[EndReason] IS NULL OR [EndReason] <> 'Removed' OR [EndNote] IS NOT NULL");
        });
        builder.HasKey(member => member.MembershipId).HasName("PK_RoomMembers");
        builder.Property(member => member.JoinedVia).HasMaxLength(20).IsUnicode(false).IsRequired();
        builder.Property(member => member.JoinedAt).HasDefaultValueSql("SYSUTCDATETIME()", "DF_RoomMembers_JoinedAt");
        builder.Property(member => member.EndReason).HasMaxLength(20).IsUnicode(false);
        builder.Property(member => member.EndNote).HasMaxLength(300);
        builder.HasIndex(member => new { member.CourseId, member.StudentId }).IsUnique().HasFilter("[EndedAt] IS NULL").HasDatabaseName("UX_RoomMembers_Course_Student");
        builder.HasIndex(member => new { member.RoomId, member.StudentId }).HasDatabaseName("IX_RoomMembers_Room_Student");
        builder.HasOne<CourseEnrollment>().WithMany()
            .HasForeignKey(member => new { member.CourseId, member.StudentId })
            .HasConstraintName("FK_RoomMembers_CourseEnrollments").OnDelete(DeleteBehavior.NoAction);
    }
}
