using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Data;
using ExeGroup.Realtime.Repositories.Entities;
using ExeGroup.Realtime.Repositories.Interfaces;
using ExeGroup.Realtime.Services.Notifications;
using ExeGroup.Realtime.Services.Push;
using Microsoft.Extensions.Logging;

namespace ExeGroup.Realtime.Services.Events;

public sealed record GroupEventMessage(Guid EventId, string Type, Guid AggregateId, string Payload, string? CorrelationId);

public interface IGroupEventHandler
{
    Task<bool> HandleAsync(GroupEventMessage message, CancellationToken cancellationToken);
}

public sealed class GroupEventHandler(
    IGroupEventRepository events,
    IRealtimePush push,
    ITransactionRunner transactions,
    IClock clock,
    ILogger<GroupEventHandler> logger) : IGroupEventHandler
{
    public const int MaxTitleLength = 200;
    public const int MaxBodyLength = 500;
    public const int MaxConversationTitleLength = 50;

    private static readonly JsonSerializerOptions PayloadJson = new(JsonSerializerDefaults.Web);

    public async Task<bool> HandleAsync(GroupEventMessage message, CancellationToken cancellationToken)
    {
        var pushes = new List<Func<CancellationToken, Task>>();
        var handled = await transactions.ExecuteAsync(
            async token =>
            {
                pushes.Clear();
                if (await events.IsProcessedAsync(message.EventId, token))
                {
                    return false;
                }

                await ApplyAsync(message, pushes, token);
                events.MarkProcessed(new ProcessedEvent { EventId = message.EventId, EventType = message.Type, ProcessedAtUtc = clock.UtcNow });
                await events.SaveChangesAsync(token);
                return true;
            },
            cancellationToken);
        if (!handled)
        {
            logger.LogInformation("Skipped event {EventId} ({EventType}): already processed", message.EventId, message.Type);
            return false;
        }

        foreach (var send in pushes)
        {
            try
            {
                await send(cancellationToken);
            }
            catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
            {
                logger.LogWarning(exception, "Event {EventId} ({EventType}) is stored but could not be pushed to browsers", message.EventId, message.Type);
            }
        }

        return true;
    }

    private async Task ApplyAsync(GroupEventMessage message, List<Func<CancellationToken, Task>> pushes, CancellationToken cancellationToken)
    {
        switch (message.Type)
        {
            case GroupEventTypes.RoomMemberJoined:
                await MemberJoinedAsync(Read<RoomMemberJoined>(message), message.Type, pushes, cancellationToken);
                break;
            case GroupEventTypes.RoomMemberLeft:
                await MemberLeftAsync(Read<RoomMemberLeft>(message), message.Type, pushes, cancellationToken);
                break;
            case GroupEventTypes.RoomLeaderChanged:
                LeaderChanged(Read<RoomLeaderChanged>(message), message.Type, pushes);
                break;
            case GroupEventTypes.RoomStatusChanged:
                var status = Read<RoomStatusChanged>(message);
                Board(status.CourseId, status.RoomId, status.RoomName, message.Type, pushes);
                break;
            case GroupEventTypes.JoinRequestSubmitted:
                var submitted = Read<JoinRequestSubmitted>(message);
                if (submitted.LeaderId is { } leaderId)
                {
                    Notify(leaderId, message.Type, $"New application to {submitted.RoomName}", $"A student applied to join {submitted.RoomName}.", pushes);
                }

                break;
            case GroupEventTypes.JoinRequestDecided:
                RequestDecided(Read<JoinRequestDecided>(message), message.Type, pushes);
                break;
            case GroupEventTypes.CoursePhaseChanged:
                PhaseChanged(Read<CoursePhaseChanged>(message), message.Type, pushes);
                break;
            default:
                logger.LogWarning("Event {EventId} has the unknown type {EventType}; it is marked as processed", message.EventId, message.Type);
                break;
        }
    }

    private async Task MemberJoinedAsync(RoomMemberJoined joined, string type, List<Func<CancellationToken, Task>> pushes, CancellationToken cancellationToken)
    {
        var conversation = await events.FindConversationAsync(joined.RoomId, cancellationToken);
        if (conversation is null)
        {
            events.Add(new Conversation
            {
                ConversationId = joined.RoomId,
                CourseId = joined.CourseId,
                Title = Trim(joined.RoomName, MaxConversationTitleLength),
                CreatedAt = clock.UtcNow,
            });
        }
        else if (conversation.Title != joined.RoomName)
        {
            conversation.Title = Trim(joined.RoomName, MaxConversationTitleLength);
        }

        var member = await events.FindMemberForUpdateAsync(joined.RoomId, joined.StudentId, cancellationToken);
        if (member is null)
        {
            events.Add(new ConversationMember { ConversationId = joined.RoomId, UserId = joined.StudentId, JoinedAt = clock.UtcNow });
        }
        else
        {
            member.LeftAt = null;
        }

        pushes.Add(token => push.JoinConversationAsync(joined.StudentId, joined.RoomId, token));
        if (joined.LeaderId is { } leaderId && leaderId != joined.StudentId)
        {
            Notify(leaderId, type, $"New member in {joined.RoomName}", $"A student joined {joined.RoomName}.", pushes);
        }

        if (joined.JoinedVia == "Admin")
        {
            Notify(joined.StudentId, type, $"Placed in {joined.RoomName}", $"An administrator placed you in {joined.RoomName}.", pushes);
        }

        Board(joined.CourseId, joined.RoomId, joined.RoomName, type, pushes);
    }

    private async Task MemberLeftAsync(RoomMemberLeft left, string type, List<Func<CancellationToken, Task>> pushes, CancellationToken cancellationToken)
    {
        if (await events.FindMemberForUpdateAsync(left.RoomId, left.StudentId, cancellationToken) is { LeftAt: null } member)
        {
            member.LeftAt = clock.UtcNow;
        }

        pushes.Add(token => push.LeaveConversationAsync(left.StudentId, left.RoomId, token));
        switch (left.EndReason)
        {
            case "Removed":
                var reason = string.IsNullOrWhiteSpace(left.EndNote) ? string.Empty : $": {left.EndNote}";
                Notify(left.StudentId, type, $"Removed from {left.RoomName}", $"The leader removed you from {left.RoomName}{reason}", pushes);
                break;
            case "Moved":
                Notify(left.StudentId, type, $"Moved out of {left.RoomName}", $"An administrator moved you out of {left.RoomName}.", pushes);
                break;
        }

        Board(left.CourseId, left.RoomId, left.RoomName, type, pushes);
    }

    private void LeaderChanged(RoomLeaderChanged changed, string type, List<Func<CancellationToken, Task>> pushes)
    {
        if (changed.LeaderId is { } leaderId)
        {
            Notify(leaderId, type, $"You lead {changed.RoomName}", $"You are now the leader of {changed.RoomName}.", pushes);
        }

        Board(changed.CourseId, changed.RoomId, changed.RoomName, type, pushes);
    }

    private void RequestDecided(JoinRequestDecided decided, string type, List<Func<CancellationToken, Task>> pushes)
    {
        var room = decided.RoomName;
        (string Title, string Body)? text = (decided.Status, decided.ReasonCode) switch
        {
            ("Approved", _) => ("Application approved", $"You joined {room}."),
            (_, "REJECTED_BY_LEADER") => ("Application rejected", $"The leader of {room} rejected your application."),
            (_, "ROOM_FULL") => ("Application rejected", $"{room} is full."),
            (_, "COMPOSITION_RULE") => ("Application rejected", $"Adding you would leave {room} too few seats for the majors it still needs."),
            (_, "GROUPING_EXPIRED") => ("Application closed", $"The deadline passed before {room} decided on your application."),
            (_, "JOINED_ANOTHER_ROOM") => ("Application cancelled", $"Your application to {room} was cancelled because you joined another room."),
            (_, "ROOM_REOPENED") => ("Application cancelled", $"{room} is open again: join it directly."),
            _ => null,
        };
        if (text is { } notice)
        {
            Notify(decided.StudentId, type, notice.Title, notice.Body, pushes);
        }
    }

    private void PhaseChanged(CoursePhaseChanged changed, string type, List<Func<CancellationToken, Task>> pushes)
    {
        (string Title, string Body)? text = changed.Phase switch
        {
            "Published" => ("Rooms are open", $"{changed.CourseName}: rooms are open. Join one or apply to a locked room."),
            "Expired" => ("Grouping closed", $"{changed.CourseName}: the deadline passed. The administrator places students without a room."),
            "Finalized" => ("Groups are final", $"{changed.CourseName}: the groups are now official."),
            _ => null,
        };
        if (text is not { } notice)
        {
            return;
        }

        foreach (var studentId in (changed.StudentIds ?? []).Distinct())
        {
            Notify(studentId, type, notice.Title, notice.Body, pushes);
        }

        if (changed.Phase == "Finalized" && changed.LecturerId is { } lecturerId)
        {
            Notify(lecturerId, type, notice.Title, notice.Body, pushes);
        }
    }

    private void Notify(Guid userId, string type, string title, string body, List<Func<CancellationToken, Task>> pushes)
    {
        var notification = new Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = userId,
            Type = type,
            Title = Trim(title, MaxTitleLength),
            Body = Trim(body, MaxBodyLength),
            CreatedAt = clock.UtcNow,
        };
        events.Add(notification);
        var model = new NotificationModel(notification.NotificationId, notification.Type, notification.Title, notification.Body, notification.CreatedAt, null);
        pushes.Add(token => push.NotificationAsync(userId, model, token));
    }

    private void Board(Guid courseId, Guid roomId, string roomName, string type, List<Func<CancellationToken, Task>> pushes) =>
        pushes.Add(token => push.RoomChangedAsync(new RoomChangeModel(courseId, roomId, roomName, type), token));

    private static T Read<T>(GroupEventMessage message) =>
        JsonSerializer.Deserialize<T>(message.Payload, PayloadJson) ?? throw new JsonException($"Event {message.EventId} has an empty payload.");

    private static string Trim(string text, int length) => text.Length <= length ? text : text[..length];
}
