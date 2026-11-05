using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Realtime.Repositories.Entities;
using ExeGroup.Realtime.Repositories.Interfaces;

namespace ExeGroup.Realtime.Services.Notifications;

public sealed record NotificationModel(Guid Id, string Type, string Title, string Body, DateTime CreatedAt, DateTime? ReadAt);

public interface INotificationService
{
    Task<PagedResult<NotificationModel>> ListMineAsync(bool unreadOnly, ListQuery query, CancellationToken cancellationToken);

    Task<NotificationModel> MarkReadAsync(Guid notificationId, CancellationToken cancellationToken);

    Task<int> MarkAllReadAsync(CancellationToken cancellationToken);
}

public sealed class NotificationService(INotificationRepository notifications, ICurrentUser currentUser, IClock clock) : INotificationService
{
    public async Task<PagedResult<NotificationModel>> ListMineAsync(bool unreadOnly, ListQuery query, CancellationToken cancellationToken) =>
        (await notifications.GetPageAsync(currentUser.RequireUserId(), unreadOnly, query, cancellationToken)).Map(ToModel);

    public async Task<NotificationModel> MarkReadAsync(Guid notificationId, CancellationToken cancellationToken)
    {
        var notification = await notifications.FindAsync(notificationId, cancellationToken);
        if (notification is null || notification.UserId != currentUser.RequireUserId())
        {
            throw new NotFoundException("Notification", notificationId);
        }

        if (notification.ReadAt is null)
        {
            notification.ReadAt = clock.UtcNow;
            await notifications.SaveChangesAsync(cancellationToken);
        }

        return ToModel(notification);
    }

    public Task<int> MarkAllReadAsync(CancellationToken cancellationToken) =>
        notifications.MarkAllReadAsync(currentUser.RequireUserId(), clock.UtcNow, cancellationToken);

    private static NotificationModel ToModel(Notification notification) =>
        new(notification.NotificationId, notification.Type, notification.Title, notification.Body, notification.CreatedAt, notification.ReadAt);
}
