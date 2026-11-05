using ExeGroup.Realtime.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Realtime.Repositories.Data.Configurations;

public sealed class MessageConfiguration : IEntityTypeConfiguration<Message>
{
    public void Configure(EntityTypeBuilder<Message> builder)
    {
        builder.ToTable("Messages");
        builder.HasKey(message => message.MessageId).HasName("PK_Messages");
        builder.Property(message => message.SenderName).HasMaxLength(150).IsRequired();
        builder.Property(message => message.Content).HasMaxLength(2000).IsRequired();
        builder.Property(message => message.SentAt).HasDefaultValueSql("SYSUTCDATETIME()", "DF_Messages_SentAt");
        builder.HasIndex(message => new { message.ConversationId, message.SentAt }).HasDatabaseName("IX_Messages_Conversation_SentAt");
        builder.HasOne<Conversation>().WithMany().HasForeignKey(message => message.ConversationId)
            .HasConstraintName("FK_Messages_Conversations").OnDelete(DeleteBehavior.NoAction);
    }
}
