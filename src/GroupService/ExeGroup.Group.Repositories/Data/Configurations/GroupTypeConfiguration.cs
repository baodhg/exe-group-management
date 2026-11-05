using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Group.Repositories.Data.Configurations;

public sealed class GroupTypeConfiguration : IEntityTypeConfiguration<GroupType>
{
    public void Configure(EntityTypeBuilder<GroupType> builder)
    {
        builder.ToTable("GroupTypes", table => table.HasCheckConstraint("CK_GroupTypes_MinDistinctMajors", "[MinDistinctMajors] >= 1"));
        builder.HasKey(groupType => groupType.GroupTypeId).HasName("PK_GroupTypes");
        builder.Property(groupType => groupType.Code).HasMaxLength(20).IsUnicode(false).IsRequired();
        builder.Property(groupType => groupType.Name).HasMaxLength(100).IsRequired();
        builder.Property(groupType => groupType.MinDistinctMajors).HasDefaultValue(2, "DF_GroupTypes_MinDistinctMajors");
        builder.HasIndex(groupType => groupType.Code).IsUnique().HasDatabaseName("UX_GroupTypes_Code");
        builder.HasMany(groupType => groupType.Majors).WithOne().HasForeignKey(major => major.GroupTypeId)
            .HasConstraintName("FK_GroupTypeMajors_GroupTypes").OnDelete(DeleteBehavior.NoAction);
    }
}
