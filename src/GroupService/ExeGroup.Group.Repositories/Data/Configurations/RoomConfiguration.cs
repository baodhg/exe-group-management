using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Group.Repositories.Data.Configurations;

public sealed class RoomConfiguration : IEntityTypeConfiguration<Room>
{
    public void Configure(EntityTypeBuilder<Room> builder)
    {
        builder.ToTable("Rooms", table =>
        {
            table.HasCheckConstraint("CK_Rooms_Status", "[Status] IN ('Open', 'Locked', 'Finalized')");
            table.HasCheckConstraint("CK_Rooms_MemberCount", "[MemberCount] >= 0 AND [MemberCount] <= [Capacity]");
            table.HasCheckConstraint("CK_Rooms_Leader", "([MemberCount] = 0 AND [LeaderId] IS NULL) OR ([MemberCount] > 0 AND [LeaderId] IS NOT NULL)");
        });
        builder.HasKey(room => room.RoomId).HasName("PK_Rooms");
        builder.HasAlternateKey(room => new { room.RoomId, room.CourseId }).HasName("AK_Rooms_RoomId_CourseId");
        builder.Property(room => room.Name).HasMaxLength(50).IsRequired();
        builder.Property(room => room.Topic).HasMaxLength(200);
        builder.Property(room => room.Status).HasMaxLength(20).IsUnicode(false).IsRequired().HasDefaultValue(RoomStatuses.Open, "DF_Rooms_Status");
        builder.Property(room => room.MemberCount).HasDefaultValue(0, "DF_Rooms_MemberCount");
        builder.Property(room => room.RowVersion).IsRowVersion();
        builder.HasIndex(room => new { room.CourseId, room.Name }).IsUnique().HasDatabaseName("UX_Rooms_Course_Name");
        builder.HasIndex(room => new { room.CourseId, room.GroupNo }).IsUnique().HasFilter("[GroupNo] IS NOT NULL").HasDatabaseName("UX_Rooms_Course_GroupNo");
        builder.HasIndex(room => new { room.SemesterId, room.GroupTypeId }).HasDatabaseName("IX_Rooms_Semester_GroupType");
        builder.HasOne<Course>().WithMany()
            .HasForeignKey(room => new { room.CourseId, room.SemesterId })
            .HasPrincipalKey(course => new { course.CourseId, course.SemesterId })
            .HasConstraintName("FK_Rooms_Courses").OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<SemesterGroupType>().WithMany()
            .HasForeignKey(room => new { room.SemesterId, room.GroupTypeId })
            .HasConstraintName("FK_Rooms_SemesterGroupTypes").OnDelete(DeleteBehavior.NoAction);
        builder.HasMany(room => room.Members).WithOne()
            .HasForeignKey(member => new { member.RoomId, member.CourseId })
            .HasPrincipalKey(room => new { room.RoomId, room.CourseId })
            .HasConstraintName("FK_RoomMembers_Rooms").OnDelete(DeleteBehavior.NoAction);
    }
}
