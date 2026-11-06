using System.Collections.Concurrent;
using ExeGroup.Realtime.API.Models.Conversations;
using ExeGroup.Realtime.API.Models.Notifications;
using ExeGroup.Realtime.Services.Conversations;
using ExeGroup.Realtime.Services.Notifications;
using ExeGroup.Realtime.Services.Push;
using Microsoft.AspNetCore.SignalR;

namespace ExeGroup.Realtime.API.Hubs;

public sealed class ConnectionRegistry
{
    private readonly ConcurrentDictionary<Guid, ConcurrentDictionary<string, byte>> _connections = new();

    public void Add(Guid userId, string connectionId) => _connections.GetOrAdd(userId, _ => new()).TryAdd(connectionId, 0);

    public void Remove(Guid userId, string connectionId)
    {
        if (_connections.TryGetValue(userId, out var connections))
        {
            connections.TryRemove(connectionId, out _);
        }
    }

    public IReadOnlyList<string> ConnectionsOf(Guid userId) =>
        _connections.TryGetValue(userId, out var connections) ? [.. connections.Keys] : [];
}

public sealed class HubPush(IHubContext<RealtimeHub> hub, ConnectionRegistry connections) : IRealtimePush
{
    public Task NotificationAsync(Guid userId, NotificationModel notification, CancellationToken cancellationToken) =>
        hub.Clients.User(userId.ToString()).SendAsync(RealtimeHub.NotificationReceived, notification.ToResponse(), cancellationToken);

    public Task MessageAsync(MessageModel message, CancellationToken cancellationToken) =>
        hub.Clients.Group(RealtimeHub.ConversationGroup(message.ConversationId)).SendAsync(RealtimeHub.MessageReceived, message.ToResponse(), cancellationToken);

    public Task RoomChangedAsync(RoomChangeModel change, CancellationToken cancellationToken) =>
        hub.Clients.Group(RealtimeHub.CourseGroup(change.CourseId)).SendAsync(RealtimeHub.RoomChanged, change, cancellationToken);

    public async Task JoinConversationAsync(Guid userId, Guid conversationId, CancellationToken cancellationToken)
    {
        foreach (var connectionId in connections.ConnectionsOf(userId))
        {
            await hub.Groups.AddToGroupAsync(connectionId, RealtimeHub.ConversationGroup(conversationId), cancellationToken);
        }
    }

    public async Task LeaveConversationAsync(Guid userId, Guid conversationId, CancellationToken cancellationToken)
    {
        foreach (var connectionId in connections.ConnectionsOf(userId))
        {
            await hub.Groups.RemoveFromGroupAsync(connectionId, RealtimeHub.ConversationGroup(conversationId), cancellationToken);
        }
    }
}
