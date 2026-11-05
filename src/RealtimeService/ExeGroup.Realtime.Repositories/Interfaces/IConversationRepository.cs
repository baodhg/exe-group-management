using ExeGroup.Realtime.Repositories.Entities;

namespace ExeGroup.Realtime.Repositories.Interfaces;

public sealed record ConversationListItem(Conversation Conversation, ConversationMember Membership, Message? LastMessage);

public interface IConversationRepository
{
    Task<IReadOnlyList<ConversationListItem>> ListForMemberAsync(Guid userId, CancellationToken cancellationToken);

    Task<bool> ExistsAsync(Guid conversationId, CancellationToken cancellationToken);

    Task<ConversationMember?> FindMembershipAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken);
}

public interface IMessageRepository
{
    Task<Message?> FindAsync(Guid messageId, CancellationToken cancellationToken);

    Task<IReadOnlyList<Message>> ListBeforeAsync(
        Guid conversationId,
        Message? before,
        DateTime? visibleUntil,
        int take,
        CancellationToken cancellationToken);

    void Add(Message message);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
