using ExeGroup.Realtime.Repositories.Entities;

namespace ExeGroup.Realtime.Repositories.Interfaces;

public interface IGroupEventRepository
{
    Task<bool> IsProcessedAsync(Guid eventId, CancellationToken cancellationToken);

    void MarkProcessed(ProcessedEvent processedEvent);

    Task<int> DeleteProcessedBeforeAsync(DateTime processedBeforeUtc, CancellationToken cancellationToken);

    Task<Conversation?> FindConversationAsync(Guid conversationId, CancellationToken cancellationToken);

    Task<ConversationMember?> FindMemberForUpdateAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken);

    void Add(Conversation conversation);

    void Add(ConversationMember member);

    void Add(Notification notification);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
