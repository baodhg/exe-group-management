using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Group.Repositories.Data.Configurations;

public sealed class StudentSkillConfiguration : IEntityTypeConfiguration<StudentSkill>
{
    public void Configure(EntityTypeBuilder<StudentSkill> builder)
    {
        builder.ToTable("StudentSkills", table => table.HasCheckConstraint("CK_StudentSkills_Level", "[Level] BETWEEN 1 AND 5"));
        builder.HasKey(skill => new { skill.SemesterId, skill.StudentId, skill.SkillId }).HasName("PK_StudentSkills");
        builder.Property(skill => skill.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()", "DF_StudentSkills_UpdatedAt");
        builder.HasIndex(skill => skill.SkillId).HasDatabaseName("IX_StudentSkills_SkillId");
        builder.HasOne<Skill>().WithMany().HasForeignKey(skill => skill.SkillId)
            .HasConstraintName("FK_StudentSkills_Skills").OnDelete(DeleteBehavior.NoAction);
    }
}
