using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.Repositories.Interfaces;

public sealed class TopicProposalRow
{
    public required TopicProposal Proposal { get; init; }

    public required string RoomName { get; init; }

    public int? GroupNo { get; init; }

    public Guid? LeaderId { get; init; }
}

public sealed record TopicProposalFilter(Guid? CourseId, Guid? RoomId, string? Status);

public interface ITopicProposalRepository
{
    Task<PagedResult<TopicProposalRow>> GetPageAsync(TopicProposalFilter filter, ListQuery query, CancellationToken cancellationToken);

    Task<TopicProposalRow?> FindRowAsync(Guid proposalId, CancellationToken cancellationToken);

    Task<TopicProposal?> FindAsync(Guid proposalId, CancellationToken cancellationToken);

    Task<TopicProposal?> FindLatestForRoomAsync(Guid roomId, CancellationToken cancellationToken);

    Task<int> NextRoundAsync(Guid roomId, CancellationToken cancellationToken);

    Task<List<TopicProposal>> ListForRoomsAsync(IReadOnlyCollection<Guid> roomIds, CancellationToken cancellationToken);

    void Add(TopicProposal proposal);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
