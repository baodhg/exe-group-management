using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using ExeGroup.Group.Services.Events;
using ExeGroup.Group.Services.Rooms;

namespace ExeGroup.Group.Services.Topics;

public sealed record TopicProposalModel(
    Guid Id,
    Guid CourseId,
    Guid RoomId,
    string RoomName,
    int? GroupNo,
    int Round,
    string ProposedTopic,
    string? Description,
    Guid ProposedBy,
    string Status,
    Guid? ReviewedBy,
    DateTime? ReviewedAt,
    string? ReviewNote,
    DateTime CreatedAt)
{
    public bool IsPending => Status == TopicProposalStatuses.Pending;
}

public sealed record TopicProposalListFilter(Guid? CourseId, Guid? RoomId, string? Status);

public interface ITopicProposalService
{
    Task<PagedResult<TopicProposalModel>> ListAsync(TopicProposalListFilter filter, ListQuery query, CancellationToken cancellationToken);

    Task<TopicProposalModel> GetAsync(Guid proposalId, CancellationToken cancellationToken);

    Task<TopicProposalModel> ProposeAsync(Guid roomId, string topic, string? description, CancellationToken cancellationToken);

    Task<TopicProposalModel> ReviewAsync(Guid proposalId, string decision, string? note, decimal? score, CancellationToken cancellationToken);

    Task<TopicProposalModel?> LatestForRoomAsync(Guid roomId, CancellationToken cancellationToken);
}

public sealed class TopicProposalService(
    ITopicProposalRepository proposals,
    IRoomRepository rooms,
    IOutbox outbox,
    ITransactionRunner transactions,
    ICurrentUser currentUser,
    IClock clock) : ITopicProposalService
{
    public const int MaxTopicLength = 200;
    public const int MaxDescriptionLength = 1000;
    public const int MaxNoteLength = 500;
    public const int MaxRounds = 5;

    private static readonly string[] Statuses =
        [TopicProposalStatuses.Pending, TopicProposalStatuses.Approved, TopicProposalStatuses.Rejected, TopicProposalStatuses.NeedsRevision];

    private static readonly string[] Decisions =
        [TopicProposalStatuses.Approved, TopicProposalStatuses.Rejected, TopicProposalStatuses.NeedsRevision];

    public async Task<PagedResult<TopicProposalModel>> ListAsync(TopicProposalListFilter filter, ListQuery query, CancellationToken cancellationToken)
    {
        string? status = null;
        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            status = Statuses.FirstOrDefault(known => string.Equals(known, filter.Status.Trim(), StringComparison.OrdinalIgnoreCase))
                ?? throw new ValidationFailedException("status", $"Status must be one of {string.Join(", ", Statuses)}.");
        }

        Guid? roomId = filter.RoomId;
        Guid? courseId = filter.CourseId;
        if (!currentUser.IsInRole(Roles.Administrator) && !currentUser.IsInRole(Roles.Lecturer))
        {
            var userId = currentUser.RequireUserId();
            var ledRooms = await rooms.ListLedRoomsAsync(userId, cancellationToken);
            if (ledRooms.Count == 0)
            {
                throw new ForbiddenException("Only the room leaders, the lecturer and administrators can see topic proposals.");
            }

            roomId = filter.RoomId is { } requested && ledRooms.Contains(requested) ? requested : null;
            courseId = null;
        }
        else if (!currentUser.IsInRole(Roles.Administrator) && courseId is { } ownedCourseId)
        {
            var course = await rooms.FindCourseAsync(ownedCourseId, cancellationToken);
            if (course is null || course.LecturerId != currentUser.RequireUserId())
            {
                throw new ForbiddenException("Only the lecturer of this course can see its topic proposals.");
            }
        }

        var page = await proposals.GetPageAsync(new TopicProposalFilter(courseId, roomId, status), query, cancellationToken);
        return new PagedResult<TopicProposalModel>(page.Items.Select(ToModel).ToList(), page.Page, page.PageSize, page.TotalItems);
    }

    public async Task<TopicProposalModel> GetAsync(Guid proposalId, CancellationToken cancellationToken)
    {
        var row = await proposals.FindRowAsync(proposalId, cancellationToken) ?? throw new NotFoundException("TopicProposal", proposalId);
        await EnsureCanReadAsync(row, cancellationToken);
        return ToModel(row);
    }

    public async Task<TopicProposalModel?> LatestForRoomAsync(Guid roomId, CancellationToken cancellationToken)
    {
        var latest = await proposals.FindLatestForRoomAsync(roomId, cancellationToken);
        return latest is null ? null : ToModel(await RowAsync(latest, cancellationToken));
    }

    public async Task<TopicProposalModel> ProposeAsync(Guid roomId, string topic, string? description, CancellationToken cancellationToken)
    {
        var leaderId = currentUser.RequireUserId();
        var text = Required(topic, "topic", MaxTopicLength);
        var note = Optional(description, "description", MaxDescriptionLength);
        var proposalId = Guid.NewGuid();
        await transactions.ExecuteWithConflictRetryAsync(
            async token =>
            {
                var (room, course) = await seatingLoad(roomId, token);
                if (room.LeaderId != leaderId)
                {
                    throw RoomService.NotLeader();
                }

                RoomSeating.EnsurePublished(course, clock.UtcNow);
                var latest = await proposals.FindLatestForRoomAsync(roomId, token);
                if (latest is { Status: TopicProposalStatuses.Pending })
                {
                    throw new ConflictException(GroupErrorCodes.ProposalPending, "A proposal of this room is still waiting for the review.");
                }

                if (latest is { Status: TopicProposalStatuses.Approved })
                {
                    throw new ConflictException(GroupErrorCodes.ProposalApproved, "This topic was already approved; it cannot be proposed again.");
                }

                var round = await proposals.NextRoundAsync(roomId, token);
                if (round > MaxRounds)
                {
                    throw new ConflictException(GroupErrorCodes.ProposalRoundLimit, $"A room can propose a topic at most {MaxRounds} times.");
                }

                proposals.Add(new TopicProposal
                {
                    ProposalId = proposalId,
                    RoomId = room.RoomId,
                    CourseId = room.CourseId,
                    Round = round,
                    ProposedTopic = text,
                    Description = note,
                    ProposedBy = leaderId,
                    Status = TopicProposalStatuses.Pending,
                    CreatedAt = clock.UtcNow,
                });
                outbox.Enqueue(
                    GroupEventTypes.TopicProposed,
                    proposalId,
                    new TopicProposedEvent(proposalId, room.CourseId, room.RoomId, room.Name, round, text, leaderId, course.LecturerId));
                await proposals.SaveChangesAsync(token);
                return true;
            },
            cancellationToken);
        return await GetAsync(proposalId, cancellationToken);
    }

    public async Task<TopicProposalModel> ReviewAsync(Guid proposalId, string decision, string? note, decimal? score, CancellationToken cancellationToken)
    {
        var verdict = Decisions.FirstOrDefault(known => string.Equals(known, decision?.Trim(), StringComparison.OrdinalIgnoreCase))
            ?? throw new ValidationFailedException("decision", $"Decision must be one of {string.Join(", ", Decisions)}.");
        var text = Optional(note, "note", MaxNoteLength);
        var reviewerId = currentUser.RequireUserId();
        await transactions.ExecuteWithConflictRetryAsync(
            async token =>
            {
                var proposal = await proposals.FindAsync(proposalId, token) ?? throw new NotFoundException("TopicProposal", proposalId);
                var (room, course) = await seatingLoad(proposal.RoomId, token);
                await EnsureReviewerAsync(course, reviewerId);
                if (proposal.Status != TopicProposalStatuses.Pending)
                {
                    throw new ConflictException(GroupErrorCodes.ProposalNotPending, $"This proposal is already {proposal.Status}.");
                }

                proposal.Status = verdict;
                proposal.ReviewedBy = reviewerId;
                proposal.ReviewedAt = clock.UtcNow;
                proposal.ReviewNote = text;
                if (verdict == TopicProposalStatuses.Approved)
                {
                    room.Topic = proposal.ProposedTopic;
                    if (course.Phase == CoursePhases.Published && course.ExpireAt is { } deadline && deadline <= clock.UtcNow)
                    {
                        throw new ConflictException(GroupErrorCodes.CourseNotPublished, "The topic can only be approved while the course is published.");
                    }
                }

                outbox.Enqueue(
                    GroupEventTypes.TopicReviewed,
                    proposal.ProposalId,
                    new TopicReviewedEvent(proposal.ProposalId, proposal.CourseId, proposal.RoomId, room.Name, proposal.Round, proposal.ProposedTopic, verdict, text, reviewerId, course.LecturerId));
                await proposals.SaveChangesAsync(token);
                return true;
            },
            cancellationToken);
        return await GetAsync(proposalId, cancellationToken);
    }

    private async Task EnsureCanReadAsync(TopicProposalRow row, CancellationToken cancellationToken)
    {
        if (currentUser.IsInRole(Roles.Administrator))
        {
            return;
        }

        var userId = currentUser.RequireUserId();
        if (row.Proposal.ProposedBy == userId || row.LeaderId == userId)
        {
            return;
        }

        var course = await rooms.FindCourseAsync(row.Proposal.CourseId, cancellationToken);
        if (currentUser.IsInRole(Roles.Lecturer) && course?.LecturerId == userId)
        {
            return;
        }

        throw new ForbiddenException("Only the leader of the room, its lecturer and administrators can see this proposal.");
    }

    private async Task EnsureReviewerAsync(Course course, Guid reviewerId)
    {
        if (currentUser.IsInRole(Roles.Administrator))
        {
            return;
        }

        if (currentUser.IsInRole(Roles.Lecturer) && course.LecturerId == reviewerId)
        {
            return;
        }

        throw new ForbiddenException("Only the lecturer of the course and administrators can review a topic proposal.");
    }

    private async Task<(Room Room, Course Course)> seatingLoad(Guid roomId, CancellationToken cancellationToken)
    {
        var room = await rooms.FindAsync(roomId, cancellationToken) ?? throw new NotFoundException("Room", roomId);
        var course = await rooms.FindCourseAsync(room.CourseId, cancellationToken) ?? throw new NotFoundException("Course", room.CourseId);
        return (room, course);
    }

    private async Task<TopicProposalRow> RowAsync(TopicProposal proposal, CancellationToken cancellationToken) =>
        await proposals.FindRowAsync(proposal.ProposalId, cancellationToken)
        ?? throw new NotFoundException("TopicProposal", proposal.ProposalId);

    private static TopicProposalModel ToModel(TopicProposalRow row) =>
        new(
            row.Proposal.ProposalId,
            row.Proposal.CourseId,
            row.Proposal.RoomId,
            row.RoomName,
            row.GroupNo,
            row.Proposal.Round,
            row.Proposal.ProposedTopic,
            row.Proposal.Description,
            row.Proposal.ProposedBy,
            row.Proposal.Status,
            row.Proposal.ReviewedBy,
            row.Proposal.ReviewedAt,
            row.Proposal.ReviewNote,
            row.Proposal.CreatedAt);

    private static string Required(string? value, string field, int maxLength)
    {
        var text = value?.Trim();
        if (string.IsNullOrEmpty(text))
        {
            throw new ValidationFailedException(field, "This field is required.");
        }

        return text.Length <= maxLength
            ? text
            : throw new ValidationFailedException(field, $"Use at most {maxLength} characters.");
    }

    private static string? Optional(string? value, string field, int maxLength)
    {
        var text = value?.Trim();
        if (string.IsNullOrEmpty(text))
        {
            return null;
        }

        return text.Length <= maxLength
            ? text
            : throw new ValidationFailedException(field, $"Use at most {maxLength} characters.");
    }
}
