using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.Realtime.API.Models.Conversations;
using ExeGroup.Realtime.Services.Conversations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace ExeGroup.Realtime.API.Hubs;

[Authorize]
public sealed class RealtimeHub(IConversationService conversations, ConnectionRegistry connections) : Hub
{
    public const string Route = "/hubs/realtime";
    public const string NotificationReceived = "notificationReceived";
    public const string MessageReceived = "messageReceived";
    public const string RoomChanged = "roomChanged";

    public static string ConversationGroup(Guid conversationId) => $"conversation:{conversationId}";

    public static string CourseGroup(Guid courseId) => $"course:{courseId}";

    public override async Task OnConnectedAsync()
    {
        var userId = RealtimeUser.IdOf(Context.User);
        connections.Add(userId, Context.ConnectionId);
        foreach (var conversationId in await conversations.ListCurrentConversationIdsAsync(userId, Context.ConnectionAborted))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, ConversationGroup(conversationId), Context.ConnectionAborted);
        }

        await base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        connections.Remove(RealtimeUser.IdOf(Context.User), Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }

    public async Task<MessageResponse> SendMessage(Guid conversationId, string content)
    {
        try
        {
            var message = await conversations.SendAsync(conversationId, RealtimeUser.SenderOf(Context.User), content ?? string.Empty, Context.ConnectionAborted);
            return message.ToResponse();
        }
        catch (AppException error)
        {
            throw new HubException($"{error.Code}: {error.Message}");
        }
    }

    public Task WatchCourse(Guid courseId) => Groups.AddToGroupAsync(Context.ConnectionId, CourseGroup(courseId), Context.ConnectionAborted);

    public Task UnwatchCourse(Guid courseId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, CourseGroup(courseId), Context.ConnectionAborted);
}
