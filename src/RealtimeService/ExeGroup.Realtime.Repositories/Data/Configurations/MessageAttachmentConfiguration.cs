using ExeGroup.Realtime.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Realtime.Repositories.Data.Configurations;

public sealed class MessageAttachmentConfiguration : IEntityTypeConfiguration<MessageAttachment>
{
    public void Configure(EntityTypeBuilder<MessageAttachment> builder)
    {
        builder.ToTable("MessageAttachments");
        builder.HasKey(attachment => attachment.AttachmentId).HasName("PK_MessageAttachments");
        builder.Property(attachment => attachment.FileName).HasMaxLength(200).IsRequired();
        builder.Property(attachment => attachment.ContentType).HasMaxLength(100).IsRequired();
        builder.Property(attachment => attachment.SizeBytes).IsRequired();
        builder.Property(attachment => attachment.Data).IsRequired();
        builder.HasIndex(attachment => attachment.MessageId).HasDatabaseName("IX_MessageAttachments_MessageId");
        builder.HasOne<Message>().WithMany(message => message.Attachments).HasForeignKey(attachment => attachment.MessageId)
            .HasConstraintName("FK_MessageAttachments_Messages").OnDelete(DeleteBehavior.Cascade);
    }
}
