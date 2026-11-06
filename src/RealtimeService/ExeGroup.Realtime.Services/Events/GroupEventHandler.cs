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
                    Notify(leaderId, message.Type, $"Đơn mới vào {submitted.RoomName}", $"Một sinh viên vừa xin vào {submitted.RoomName}.", submitted.CourseId, submitted.RoomId, pushes);
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
            Notify(leaderId, type, $"Thành viên mới ở {joined.RoomName}", $"Một sinh viên vừa vào {joined.RoomName}.", joined.CourseId, joined.RoomId, pushes);
        }

        if (joined.JoinedVia == "Admin")
        {
            Notify(joined.StudentId, type, $"Bạn được xếp vào {joined.RoomName}", $"Giáo vụ đã xếp bạn vào {joined.RoomName}.", joined.CourseId, joined.RoomId, pushes);
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
                var reason = string.IsNullOrWhiteSpace(left.EndNote) ? "." : $". Lý do: {left.EndNote}";
                Notify(left.StudentId, type, $"Bạn không còn ở {left.RoomName}", $"Trưởng nhóm đã xoá bạn khỏi {left.RoomName}{reason}", left.CourseId, left.RoomId, pushes);
                break;
            case "Moved":
                Notify(left.StudentId, type, $"Bạn được chuyển khỏi {left.RoomName}", $"Giáo vụ đã chuyển bạn khỏi {left.RoomName}.", left.CourseId, left.RoomId, pushes);
                break;
        }

        Board(left.CourseId, left.RoomId, left.RoomName, type, pushes);
    }

    private void LeaderChanged(RoomLeaderChanged changed, string type, List<Func<CancellationToken, Task>> pushes)
    {
        if (changed.LeaderId is { } leaderId)
        {
            Notify(leaderId, type, $"Bạn là trưởng {changed.RoomName}", $"Bạn vừa trở thành trưởng nhóm {changed.RoomName}.", changed.CourseId, changed.RoomId, pushes);
        }

        Board(changed.CourseId, changed.RoomId, changed.RoomName, type, pushes);
    }

    private void RequestDecided(JoinRequestDecided decided, string type, List<Func<CancellationToken, Task>> pushes)
    {
        var room = decided.RoomName;
        (string Title, string Body)? text = (decided.Status, decided.ReasonCode) switch
        {
            ("Approved", _) => ("Đơn được duyệt", $"Bạn đã vào {room}."),
            (_, "REJECTED_BY_LEADER") => ("Đơn bị từ chối", $"Trưởng nhóm {room} đã từ chối đơn của bạn."),
            (_, "ROOM_FULL") => ("Đơn bị từ chối", $"{room} đã đủ người."),
            (_, "COMPOSITION_RULE") => ("Đơn bị từ chối", $"Nhận bạn sẽ khiến {room} không còn đủ chỗ cho các ngành còn thiếu."),
            (_, "GROUPING_EXPIRED") => ("Đơn đã đóng", $"Đã hết hạn tìm nhóm trước khi {room} quyết định đơn của bạn."),
            (_, "JOINED_ANOTHER_ROOM") => ("Đơn đã huỷ", $"Đơn vào {room} được huỷ vì bạn đã vào phòng khác."),
            (_, "ROOM_REOPENED") => ("Đơn đã huỷ", $"{room} đã mở lại, bạn có thể vào thẳng."),
            _ => null,
        };
        if (text is { } notice)
        {
            Notify(decided.StudentId, type, notice.Title, notice.Body, decided.CourseId, decided.RoomId, pushes);
        }
    }

    private void PhaseChanged(CoursePhaseChanged changed, string type, List<Func<CancellationToken, Task>> pushes)
    {
        (string Title, string Body)? text = changed.Phase switch
        {
            "Published" => ("Đã mở tìm nhóm", $"{changed.CourseName}: các phòng đã mở. Hãy vào một phòng hoặc gửi đơn vào phòng đang khoá."),
            "Expired" => ("Đã hết hạn tìm nhóm", $"{changed.CourseName}: đã hết hạn. Giáo vụ sẽ xếp các bạn chưa có phòng."),
            "Finalized" => ("Đã chốt nhóm", $"{changed.CourseName}: danh sách nhóm đã chính thức."),
            _ => null,
        };
        if (text is not { } notice)
        {
            return;
        }

        foreach (var studentId in (changed.StudentIds ?? []).Distinct())
        {
            Notify(studentId, type, notice.Title, notice.Body, changed.CourseId, null, pushes);
        }

        if (changed.Phase == "Finalized" && changed.LecturerId is { } lecturerId)
        {
            Notify(lecturerId, type, notice.Title, notice.Body, changed.CourseId, null, pushes);
        }
    }

    private void Notify(Guid userId, string type, string title, string body, Guid courseId, Guid? roomId, List<Func<CancellationToken, Task>> pushes)
    {
        var notification = new Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = userId,
            Type = type,
            Title = Trim(title, MaxTitleLength),
            Body = Trim(body, MaxBodyLength),
            CreatedAt = clock.UtcNow,
            CourseId = courseId,
            RoomId = roomId,
        };
        events.Add(notification);
        var model = new NotificationModel(notification.NotificationId, notification.Type, notification.Title, notification.Body, notification.CreatedAt, null, notification.CourseId, notification.RoomId);
        pushes.Add(token => push.NotificationAsync(userId, model, token));
    }

    private void Board(Guid courseId, Guid roomId, string roomName, string type, List<Func<CancellationToken, Task>> pushes) =>
        pushes.Add(token => push.RoomChangedAsync(new RoomChangeModel(courseId, roomId, roomName, type), token));

    private static T Read<T>(GroupEventMessage message) =>
        JsonSerializer.Deserialize<T>(message.Payload, PayloadJson) ?? throw new JsonException($"Event {message.EventId} has an empty payload.");

    private static string Trim(string text, int length) => text.Length <= length ? text : text[..length];
}
