using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Realtime.Repositories.Entities;

namespace ExeGroup.Realtime.Repositories.Interfaces;

public interface INotificationRepository
{
    Task<PagedResult<Notification>> GetPageAsync(Guid userId, bool unreadOnly, ListQuery query, CancellationToken cancellationToken);

    Task<Notification?> FindAsync(Guid notificationId, CancellationToken cancellationToken);

    Task<int> MarkAllReadAsync(Guid userId, DateTime readAt, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
