using ExeGroup.Realtime.Repositories.Data;
using ExeGroup.Realtime.Repositories.Entities;
using ExeGroup.Realtime.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Realtime.Repositories.Repositories;

public sealed class GroupEventRepository(ChatDbContext context) : IGroupEventRepository
{
    public Task<bool> IsProcessedAsync(Guid eventId, CancellationToken cancellationToken) =>
        context.ProcessedEvents.AnyAsync(processed => processed.EventId == eventId, cancellationToken);

    public void MarkProcessed(ProcessedEvent processedEvent) => context.ProcessedEvents.Add(processedEvent);

    public Task<int> DeleteProcessedBeforeAsync(DateTime processedBeforeUtc, CancellationToken cancellationToken) =>
        context.ProcessedEvents.Where(processed => processed.ProcessedAtUtc < processedBeforeUtc).ExecuteDeleteAsync(cancellationToken);

    public async Task<Conversation?> FindConversationAsync(Guid conversationId, CancellationToken cancellationToken) =>
        context.Conversations.Local.FirstOrDefault(conversation => conversation.ConversationId == conversationId)
        ?? await context.Conversations.SingleOrDefaultAsync(conversation => conversation.ConversationId == conversationId, cancellationToken);

    public async Task<ConversationMember?> FindMemberForUpdateAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken) =>
        context.ConversationMembers.Local.FirstOrDefault(member => member.ConversationId == conversationId && member.UserId == userId)
        ?? await context.ConversationMembers.SingleOrDefaultAsync(member => member.ConversationId == conversationId && member.UserId == userId, cancellationToken);

    public void Add(Conversation conversation) => context.Conversations.Add(conversation);

    public void Add(ConversationMember member) => context.ConversationMembers.Add(member);

    public void Add(Notification notification) => context.Notifications.Add(notification);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);
}
