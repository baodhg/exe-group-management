using ExeGroup.Realtime.Repositories.Entities;

namespace ExeGroup.Realtime.Repositories.Interfaces;

public sealed record ConversationListItem(Conversation Conversation, ConversationMember Membership, Message? LastMessage);

public interface IConversationRepository
{
    Task<IReadOnlyList<ConversationListItem>> ListForMemberAsync(Guid userId, CancellationToken cancellationToken);

    Task<bool> ExistsAsync(Guid conversationId, CancellationToken cancellationToken);

    Task<ConversationMember?> FindMembershipAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken);
}
