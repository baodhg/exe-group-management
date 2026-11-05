using ExeGroup.Realtime.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExeGroup.Realtime.Repositories.Data.Configurations;

public sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("Notifications");
        builder.HasKey(notification => notification.NotificationId).HasName("PK_Notifications");
        builder.Property(notification => notification.Type).HasMaxLength(50).IsUnicode(false).IsRequired();
        builder.Property(notification => notification.Title).HasMaxLength(200).IsRequired();
        builder.Property(notification => notification.Body).HasMaxLength(500).IsRequired();
        builder.Property(notification => notification.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()", "DF_Notifications_CreatedAt");
        builder.HasIndex(notification => new { notification.UserId, notification.CreatedAt }, "IX_Notifications_Unread")
            .HasFilter("[ReadAt] IS NULL");
        builder.HasIndex(notification => new { notification.UserId, notification.CreatedAt }, "IX_Notifications_User_CreatedAt");
    }
}

public sealed class ProcessedEventConfiguration : IEntityTypeConfiguration<ProcessedEvent>
{
    public void Configure(EntityTypeBuilder<ProcessedEvent> builder)
    {
        builder.ToTable("ProcessedEvents");
        builder.HasKey(processed => processed.EventId).HasName("PK_ProcessedEvents");
        builder.Property(processed => processed.EventType).HasMaxLength(100).IsUnicode(false).IsRequired();
        builder.Property(processed => processed.ProcessedAtUtc).HasDefaultValueSql("SYSUTCDATETIME()", "DF_ProcessedEvents_ProcessedAtUtc");
        builder.HasIndex(processed => processed.ProcessedAtUtc).HasDatabaseName("IX_ProcessedEvents_ProcessedAtUtc");
    }
}
