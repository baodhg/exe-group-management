using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Group.Repositories.Data.Configurations;

public sealed class OutboxEventConfiguration : IEntityTypeConfiguration<OutboxEvent>
{
    public void Configure(EntityTypeBuilder<OutboxEvent> builder)
    {
        builder.ToTable("OutboxEvents", table => table.HasCheckConstraint("CK_OutboxEvents_Payload", "ISJSON([Payload]) = 1"));
        builder.HasKey(outboxEvent => outboxEvent.EventId).HasName("PK_OutboxEvents");
        builder.Property(outboxEvent => outboxEvent.EventType).HasMaxLength(100).IsUnicode(false).IsRequired();
        builder.Property(outboxEvent => outboxEvent.Payload).IsRequired();
        builder.Property(outboxEvent => outboxEvent.CorrelationId).HasMaxLength(64).IsUnicode(false);
        builder.Property(outboxEvent => outboxEvent.OccurredAtUtc).HasDefaultValueSql("SYSUTCDATETIME()", "DF_OutboxEvents_OccurredAtUtc");
        builder.Property(outboxEvent => outboxEvent.RetryCount).HasDefaultValue(0, "DF_OutboxEvents_RetryCount");
        builder.Property(outboxEvent => outboxEvent.LastError).HasMaxLength(1000);
        builder.HasIndex(outboxEvent => outboxEvent.OccurredAtUtc).HasFilter("[PublishedAtUtc] IS NULL").HasDatabaseName("IX_OutboxEvents_Unpublished");
        builder.HasIndex(outboxEvent => outboxEvent.PublishedAtUtc).HasFilter("[PublishedAtUtc] IS NOT NULL").HasDatabaseName("IX_OutboxEvents_PublishedAtUtc");
    }
}
