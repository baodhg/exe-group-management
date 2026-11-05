using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Realtime.Repositories.Data;
using ExeGroup.Realtime.Repositories.Entities;
using ExeGroup.Realtime.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Realtime.Repositories.Repositories;

public sealed class NotificationRepository(ChatDbContext context) : INotificationRepository
{
    private static readonly SortMap<Notification> Sorting = new SortMap<Notification>()
        .Add("createdAt", notification => notification.CreatedAt)
        .Add("type", notification => notification.Type)
        .ByDefault("createdAt", descending: true)
        .TieBreaker(notification => notification.NotificationId);

    public Task<PagedResult<Notification>> GetPageAsync(Guid userId, bool unreadOnly, ListQuery query, CancellationToken cancellationToken)
    {
        var notifications = context.Notifications.AsNoTracking().Where(notification => notification.UserId == userId);
        if (unreadOnly)
        {
            notifications = notifications.Where(notification => notification.ReadAt == null);
        }

        if (query.Search is { } search)
        {
            notifications = notifications.Where(notification => notification.Title.Contains(search) || notification.Body.Contains(search));
        }

        return notifications.ToPagedResultAsync(query, Sorting, cancellationToken);
    }

    public Task<Notification?> FindAsync(Guid notificationId, CancellationToken cancellationToken) =>
        context.Notifications.SingleOrDefaultAsync(notification => notification.NotificationId == notificationId, cancellationToken);

    public Task<int> MarkAllReadAsync(Guid userId, DateTime readAt, CancellationToken cancellationToken) =>
        context.Notifications
            .Where(notification => notification.UserId == userId && notification.ReadAt == null)
            .ExecuteUpdateAsync(update => update.SetProperty(notification => notification.ReadAt, readAt), cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);
}
