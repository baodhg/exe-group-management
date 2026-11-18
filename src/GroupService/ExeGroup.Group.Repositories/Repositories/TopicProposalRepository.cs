using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Data;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Group.Repositories.Repositories;

public sealed class TopicProposalRepository(GroupDbContext context) : ITopicProposalRepository
{
    private static readonly SortMap<TopicProposalRow> Sorting = new SortMap<TopicProposalRow>()
        .Add("createdAt", row => row.Proposal.CreatedAt)
        .Add("round", row => row.Proposal.Round)
        .Add("status", row => row.Proposal.Status)
        .Add("roomName", row => row.RoomName)
        .ByDefault("createdAt", descending: true)
        .TieBreaker(row => row.Proposal.ProposalId);

    public Task<PagedResult<TopicProposalRow>> GetPageAsync(TopicProposalFilter filter, ListQuery query, CancellationToken cancellationToken)
    {
        var proposals = context.TopicProposals.AsNoTracking();
        if (filter.CourseId is { } courseId)
        {
            proposals = proposals.Where(proposal => proposal.CourseId == courseId);
        }

        if (filter.RoomId is { } roomId)
        {
            proposals = proposals.Where(proposal => proposal.RoomId == roomId);
        }

        if (filter.Status is { } status)
        {
            proposals = proposals.Where(proposal => proposal.Status == status);
        }

        var rows = Rows(proposals);
        if (query.Search is { } search)
        {
            rows = rows.Where(row =>
                row.RoomName.Contains(search)
                || row.Proposal.ProposedTopic.Contains(search)
                || (row.Proposal.Description != null && row.Proposal.Description.Contains(search)));
        }

        return rows.ToPagedResultAsync(query, Sorting, cancellationToken);
    }

    public Task<TopicProposalRow?> FindRowAsync(Guid proposalId, CancellationToken cancellationToken) =>
        Rows(context.TopicProposals.AsNoTracking().Where(proposal => proposal.ProposalId == proposalId)).SingleOrDefaultAsync(cancellationToken);

    public Task<TopicProposal?> FindAsync(Guid proposalId, CancellationToken cancellationToken) =>
        context.TopicProposals.SingleOrDefaultAsync(proposal => proposal.ProposalId == proposalId, cancellationToken);

    public Task<TopicProposal?> FindLatestForRoomAsync(Guid roomId, CancellationToken cancellationToken) =>
        context.TopicProposals
            .Where(proposal => proposal.RoomId == roomId)
            .OrderByDescending(proposal => proposal.Round)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<int> NextRoundAsync(Guid roomId, CancellationToken cancellationToken)
    {
        var highest = await context.TopicProposals
            .Where(proposal => proposal.RoomId == roomId)
            .Select(proposal => (int?)proposal.Round)
            .MaxAsync(cancellationToken);
        return (highest ?? 0) + 1;
    }

    public Task<List<TopicProposal>> ListForRoomsAsync(IReadOnlyCollection<Guid> roomIds, CancellationToken cancellationToken) =>
        context.TopicProposals
            .Where(proposal => roomIds.Contains(proposal.RoomId))
            .OrderBy(proposal => proposal.RoomId)
            .ThenBy(proposal => proposal.Round)
            .ToListAsync(cancellationToken);

    public void Add(TopicProposal proposal) => context.TopicProposals.Add(proposal);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);

    private IQueryable<TopicProposalRow> Rows(IQueryable<TopicProposal> proposals) =>
        from proposal in proposals
        join room in context.Rooms on proposal.RoomId equals room.RoomId
        select new TopicProposalRow
        {
            Proposal = proposal,
            RoomName = room.Name,
            GroupNo = room.GroupNo,
            LeaderId = room.LeaderId,
        };
}
