using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.Realtime.Repositories.Entities;
using ExeGroup.Realtime.Repositories.Interfaces;
using ExeGroup.Realtime.Services.Push;

namespace ExeGroup.Realtime.Services.Conversations;

public sealed record MessageModel(Guid Id, Guid ConversationId, Guid SenderId, string SenderName, string? Content, DateTime SentAt, bool Deleted);

public sealed record ConversationModel(Guid Id, Guid CourseId, string Title, DateTime JoinedAt, DateTime? LeftAt, MessageModel? LastMessage);

public sealed record MessagePage(IReadOnlyList<MessageModel> Items, Guid? NextBefore);

public sealed record Sender(Guid UserId, string Name);

public interface IConversationService
{
    Task<IReadOnlyList<ConversationModel>> ListMineAsync(CancellationToken cancellationToken);

    Task<MessagePage> ListMessagesAsync(Guid conversationId, Guid? before, int? pageSize, CancellationToken cancellationToken);

    Task<MessageModel> SendAsync(Guid conversationId, Sender sender, string content, CancellationToken cancellationToken);

    Task<IReadOnlyList<Guid>> ListCurrentConversationIdsAsync(Guid userId, CancellationToken cancellationToken);

    Task DeleteMessageAsync(Guid messageId, CancellationToken cancellationToken);
}

public sealed class ConversationService(
    IConversationRepository conversations,
    IMessageRepository messages,
    IRealtimePush push,
    ICurrentUser currentUser,
    IClock clock) : IConversationService
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;
    public const int MaxContentLength = 2000;
    public const int MaxSenderNameLength = 150;

    public async Task<IReadOnlyList<ConversationModel>> ListMineAsync(CancellationToken cancellationToken)
    {
        var items = await conversations.ListForMemberAsync(currentUser.RequireUserId(), cancellationToken);
        return items
            .Select(item => new ConversationModel(
                item.Conversation.ConversationId,
                item.Conversation.CourseId,
                item.Conversation.Title,
                item.Membership.JoinedAt,
                item.Membership.LeftAt,
                item.LastMessage is null ? null : ToModel(item.LastMessage)))
            .ToList();
    }

    public async Task<MessagePage> ListMessagesAsync(Guid conversationId, Guid? before, int? pageSize, CancellationToken cancellationToken)
    {
        var membership = await RequireMembershipAsync(conversationId, currentUser.RequireUserId(), cancellationToken);
        Message? cursor = null;
        if (before is { } beforeId)
        {
            cursor = await messages.FindAsync(beforeId, cancellationToken);
            if (cursor is null || cursor.ConversationId != conversationId)
            {
                throw new ValidationFailedException("before", "The message to page before is not in this conversation.");
            }
        }

        var size = pageSize switch
        {
            null or < 1 => DefaultPageSize,
            > MaxPageSize => MaxPageSize,
            _ => pageSize.Value,
        };
        var page = await messages.ListBeforeAsync(conversationId, cursor, membership.LeftAt, size + 1, cancellationToken);
        var items = page.Take(size).Select(ToModel).ToList();
        return new MessagePage(items, page.Count > size ? items[^1].Id : null);
    }

    public async Task<MessageModel> SendAsync(Guid conversationId, Sender sender, string content, CancellationToken cancellationToken)
    {
        var membership = await RequireMembershipAsync(conversationId, sender.UserId, cancellationToken);
        if (membership.LeftAt is not null)
        {
            throw new ForbiddenException("Only current members of the room can send messages.");
        }

        var text = content.Trim();
        if (text.Length is 0 or > MaxContentLength)
        {
            throw new ValidationFailedException("content", $"A message must have 1 to {MaxContentLength} characters.");
        }

        var name = sender.Name.Trim();
        var message = new Message
        {
            MessageId = Guid.NewGuid(),
            ConversationId = conversationId,
            SenderId = membership.UserId,
            SenderName = name.Length > MaxSenderNameLength ? name[..MaxSenderNameLength] : name,
            Content = text,
            SentAt = clock.UtcNow,
        };
        messages.Add(message);
        await messages.SaveChangesAsync(cancellationToken);
        var model = ToModel(message);
        await push.MessageAsync(model, cancellationToken);
        return model;
    }

    public async Task<IReadOnlyList<Guid>> ListCurrentConversationIdsAsync(Guid userId, CancellationToken cancellationToken) =>
        (await conversations.ListForMemberAsync(userId, cancellationToken))
            .Where(item => item.Membership.LeftAt is null)
            .Select(item => item.Conversation.ConversationId)
            .ToList();

    public async Task DeleteMessageAsync(Guid messageId, CancellationToken cancellationToken)
    {
        var message = await messages.FindAsync(messageId, cancellationToken) ?? throw new NotFoundException("Message", messageId);
        if (message.SenderId != currentUser.RequireUserId())
        {
            throw new ForbiddenException("Only the sender can delete a message.");
        }

        if (message.DeletedAt is null)
        {
            message.DeletedAt = clock.UtcNow;
            await messages.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task<ConversationMember> RequireMembershipAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken)
    {
        var membership = await conversations.FindMembershipAsync(conversationId, userId, cancellationToken);
        if (membership is not null)
        {
            return membership;
        }

        if (!await conversations.ExistsAsync(conversationId, cancellationToken))
        {
            throw new NotFoundException("Conversation", conversationId);
        }

        throw new ForbiddenException("Only members of the room can use its chat.");
    }

    private static MessageModel ToModel(Message message) =>
        new(
            message.MessageId,
            message.ConversationId,
            message.SenderId,
            message.SenderName,
            message.DeletedAt is null ? message.Content : null,
            message.SentAt,
            message.DeletedAt is not null);
}
