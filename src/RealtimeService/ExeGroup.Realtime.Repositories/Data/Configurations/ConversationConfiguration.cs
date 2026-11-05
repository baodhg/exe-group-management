using ExeGroup.Realtime.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Realtime.Repositories.Data.Configurations;

public sealed class ConversationConfiguration : IEntityTypeConfiguration<Conversation>
{
    public void Configure(EntityTypeBuilder<Conversation> builder)
    {
        builder.ToTable("Conversations");
        builder.HasKey(conversation => conversation.ConversationId).HasName("PK_Conversations");
        builder.Property(conversation => conversation.Title).HasMaxLength(50).IsRequired();
        builder.Property(conversation => conversation.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()", "DF_Conversations_CreatedAt");
        builder.HasIndex(conversation => conversation.CourseId).HasDatabaseName("IX_Conversations_CourseId");
        builder.HasMany(conversation => conversation.Members).WithOne().HasForeignKey(member => member.ConversationId)
            .HasConstraintName("FK_ConversationMembers_Conversations").OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class ConversationMemberConfiguration : IEntityTypeConfiguration<ConversationMember>
{
    public void Configure(EntityTypeBuilder<ConversationMember> builder)
    {
        builder.ToTable("ConversationMembers");
        builder.HasKey(member => new { member.ConversationId, member.UserId }).HasName("PK_ConversationMembers");
        builder.HasIndex(member => member.UserId).HasDatabaseName("IX_ConversationMembers_UserId");
    }
}
