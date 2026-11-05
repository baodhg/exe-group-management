using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Group.Repositories.Data.Configurations;

public sealed class SemesterGroupTypeConfiguration : IEntityTypeConfiguration<SemesterGroupType>
{
    public void Configure(EntityTypeBuilder<SemesterGroupType> builder)
    {
        builder.ToTable("SemesterGroupTypes");
        builder.HasKey(allowed => new { allowed.SemesterId, allowed.GroupTypeId }).HasName("PK_SemesterGroupTypes");
        builder.HasIndex(allowed => allowed.GroupTypeId).HasDatabaseName("IX_SemesterGroupTypes_GroupTypeId");
        builder.HasOne<Semester>().WithMany().HasForeignKey(allowed => allowed.SemesterId)
            .HasConstraintName("FK_SemesterGroupTypes_Semesters").OnDelete(DeleteBehavior.NoAction);
        builder.HasOne<GroupType>().WithMany().HasForeignKey(allowed => allowed.GroupTypeId)
            .HasConstraintName("FK_SemesterGroupTypes_GroupTypes").OnDelete(DeleteBehavior.NoAction);
    }
}
