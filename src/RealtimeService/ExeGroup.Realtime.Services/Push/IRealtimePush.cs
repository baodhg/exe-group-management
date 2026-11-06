using ExeGroup.Realtime.Services.Conversations;
using ExeGroup.Realtime.Services.Notifications;

namespace ExeGroup.Realtime.Services.Push;

public sealed record RoomChangeModel(Guid CourseId, Guid RoomId, string RoomName, string EventType);

public interface IRealtimePush
{
    Task NotificationAsync(Guid userId, NotificationModel notification, CancellationToken cancellationToken);

    Task MessageAsync(MessageModel message, CancellationToken cancellationToken);

    Task RoomChangedAsync(RoomChangeModel change, CancellationToken cancellationToken);

    Task JoinConversationAsync(Guid userId, Guid conversationId, CancellationToken cancellationToken);

    Task LeaveConversationAsync(Guid userId, Guid conversationId, CancellationToken cancellationToken);
}
