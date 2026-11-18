using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Group.Repositories.Data.Configurations;

public sealed class TopicProposalConfiguration : IEntityTypeConfiguration<TopicProposal>
{
    public void Configure(EntityTypeBuilder<TopicProposal> builder)
    {
        builder.ToTable("TopicProposals", table =>
        {
            table.HasCheckConstraint("CK_TopicProposals_Status", "[Status] IN ('Pending', 'Approved', 'Rejected', 'NeedsRevision')");
            table.HasCheckConstraint("CK_TopicProposals_Round", "[Round] >= 1");
        });
        builder.HasKey(proposal => proposal.ProposalId).HasName("PK_TopicProposals");
        builder.Property(proposal => proposal.ProposedTopic).HasMaxLength(200).IsRequired();
        builder.Property(proposal => proposal.Description).HasMaxLength(1000);
        builder.Property(proposal => proposal.Status).HasMaxLength(20).IsUnicode(false).IsRequired().HasDefaultValue(TopicProposalStatuses.Pending, "DF_TopicProposals_Status");
        builder.Property(proposal => proposal.ReviewNote).HasMaxLength(500);
        builder.Property(proposal => proposal.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()", "DF_TopicProposals_CreatedAt");
        builder.Property(proposal => proposal.RowVersion).IsRowVersion();
        builder.HasIndex(proposal => new { proposal.RoomId, proposal.Round }).IsUnique().HasDatabaseName("UX_TopicProposals_Room_Round");
        builder.HasIndex(proposal => new { proposal.CourseId, proposal.Status }).HasDatabaseName("IX_TopicProposals_Course_Status");
        builder.HasIndex(proposal => new { proposal.RoomId, proposal.Status }).HasDatabaseName("IX_TopicProposals_Room_Status");
        builder.HasOne<Room>().WithMany()
            .HasForeignKey(proposal => new { proposal.RoomId, proposal.CourseId })
            .HasPrincipalKey(room => new { room.RoomId, room.CourseId })
            .HasConstraintName("FK_TopicProposals_Rooms").OnDelete(DeleteBehavior.NoAction);
    }
}
