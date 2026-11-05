using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Group.Repositories.Data.Configurations;

public sealed class GroupTypeMajorConfiguration : IEntityTypeConfiguration<GroupTypeMajor>
{
    public void Configure(EntityTypeBuilder<GroupTypeMajor> builder)
    {
        builder.ToTable("GroupTypeMajors", table => table.HasCheckConstraint("CK_GroupTypeMajors_MinMembers", "[MinMembers] >= 1"));
        builder.HasKey(major => new { major.GroupTypeId, major.MajorId }).HasName("PK_GroupTypeMajors");
        builder.HasIndex(major => major.MajorId).HasDatabaseName("IX_GroupTypeMajors_MajorId");
        builder.HasOne<Major>().WithMany().HasForeignKey(major => major.MajorId)
            .HasConstraintName("FK_GroupTypeMajors_Majors").OnDelete(DeleteBehavior.NoAction);
    }
}
