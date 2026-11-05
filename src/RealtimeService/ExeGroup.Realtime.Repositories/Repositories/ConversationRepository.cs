using ExeGroup.Realtime.Repositories.Data;
using ExeGroup.Realtime.Repositories.Entities;
using ExeGroup.Realtime.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Realtime.Repositories.Repositories;

public sealed class ConversationRepository(ChatDbContext context) : IConversationRepository
{
    public async Task<IReadOnlyList<ConversationListItem>> ListForMemberAsync(Guid userId, CancellationToken cancellationToken)
    {
        var rows = await (
            from membership in context.ConversationMembers.AsNoTracking()
            where membership.UserId == userId
            join conversation in context.Conversations.AsNoTracking() on membership.ConversationId equals conversation.ConversationId
            select new
            {
                Conversation = conversation,
                Membership = membership,
                LastMessage = context.Messages
                    .Where(message => message.ConversationId == membership.ConversationId
                        && (membership.LeftAt == null || message.SentAt <= membership.LeftAt))
                    .OrderByDescending(message => message.SentAt)
                    .ThenByDescending(message => message.MessageId)
                    .FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        return rows
            .Select(row => new ConversationListItem(row.Conversation, row.Membership, row.LastMessage))
            .OrderBy(item => item.Membership.LeftAt is not null)
            .ThenByDescending(item => item.LastMessage?.SentAt ?? item.Membership.JoinedAt)
            .ToList();
    }

    public Task<bool> ExistsAsync(Guid conversationId, CancellationToken cancellationToken) =>
        context.Conversations.AnyAsync(conversation => conversation.ConversationId == conversationId, cancellationToken);

    public Task<ConversationMember?> FindMembershipAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken) =>
        context.ConversationMembers.AsNoTracking()
            .SingleOrDefaultAsync(member => member.ConversationId == conversationId && member.UserId == userId, cancellationToken);
}

public sealed class MessageRepository(ChatDbContext context) : IMessageRepository
{
    public Task<Message?> FindAsync(Guid messageId, CancellationToken cancellationToken) =>
        context.Messages.SingleOrDefaultAsync(message => message.MessageId == messageId, cancellationToken);

    public async Task<IReadOnlyList<Message>> ListBeforeAsync(
        Guid conversationId,
        Message? before,
        DateTime? visibleUntil,
        int take,
        CancellationToken cancellationToken)
    {
        var messages = context.Messages.AsNoTracking().Where(message => message.ConversationId == conversationId);
        if (visibleUntil is { } until)
        {
            messages = messages.Where(message => message.SentAt <= until);
        }

        if (before is not null)
        {
            var sentAt = before.SentAt;
            var messageId = before.MessageId;
            messages = messages.Where(message => message.SentAt < sentAt || (message.SentAt == sentAt && message.MessageId < messageId));
        }

        return await messages
            .OrderByDescending(message => message.SentAt)
            .ThenByDescending(message => message.MessageId)
            .Take(take)
            .ToListAsync(cancellationToken);
    }

    public void Add(Message message) => context.Messages.Add(message);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);
}
