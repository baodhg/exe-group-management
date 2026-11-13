using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using ExeGroup.Group.Services.Events;
using ExeGroup.Group.Services.Rooms;

namespace ExeGroup.Group.Services.JoinRequests;

public sealed record JoinRequestModel(
    Guid Id,
    Guid CourseId,
    Guid RoomId,
    string RoomName,
    Guid StudentId,
    string? StudentCode,
    string? StudentName,
    string? MajorCode,
    IReadOnlyList<RoomSkillModel> Skills,
    string? Message,
    string Status,
    string? ReasonCode,
    string? ReasonText,
    Guid? DecidedBy,
    DateTime? DecidedAt,
    DateTime CreatedAt);

public sealed record JoinRequestListFilter(Guid? CourseId, Guid? RoomId, string? Status);

public interface IJoinRequestService
{
    Task<PagedResult<JoinRequestModel>> ListAsync(JoinRequestListFilter filter, ListQuery query, CancellationToken cancellationToken);

    Task<JoinRequestModel> GetAsync(Guid requestId, CancellationToken cancellationToken);

    Task<JoinRequestModel> SubmitAsync(Guid roomId, string? message, CancellationToken cancellationToken);

    Task<JoinRequestModel> WithdrawAsync(Guid requestId, CancellationToken cancellationToken);

    Task<JoinRequestModel> ApproveAsync(Guid requestId, CancellationToken cancellationToken);

    Task<JoinRequestModel> RejectAsync(Guid requestId, string? reasonText, CancellationToken cancellationToken);
}

public sealed class JoinRequestService(
    IJoinRequestRepository joinRequests,
    IRoomRepository rooms,
    RoomSeating seating,
    RequestCloser closer,
    IOutbox outbox,
    ITransactionRunner transactions,
    ICurrentUser currentUser,
    IClock clock) : IJoinRequestService
{
    public const int MaxTextLength = 500;

    private static readonly string[] Statuses =
        [JoinRequestStatuses.Pending, JoinRequestStatuses.Approved, JoinRequestStatuses.Rejected, JoinRequestStatuses.Cancelled];

    public async Task<PagedResult<JoinRequestModel>> ListAsync(JoinRequestListFilter filter, ListQuery query, CancellationToken cancellationToken)
    {
        string? status = null;
        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            status = Statuses.FirstOrDefault(known => string.Equals(known, filter.Status.Trim(), StringComparison.OrdinalIgnoreCase))
                ?? throw new ValidationFailedException("status", $"Status must be one of {string.Join(", ", Statuses)}.");
        }

        Guid? studentId = null;
        if (!currentUser.IsInRole(Roles.Administrator))
        {
            var userId = currentUser.RequireUserId();
            var leadsRoom = filter.RoomId is { } roomId && (await rooms.FindRowAsync(roomId, cancellationToken))?.Room.LeaderId == userId;
            studentId = leadsRoom ? null : userId;
        }

        var page = await joinRequests.GetPageAsync(new JoinRequestFilter(studentId, filter.RoomId, filter.CourseId, status), query, cancellationToken);
        return new PagedResult<JoinRequestModel>(await ToModelsAsync(page.Items, cancellationToken), page.Page, page.PageSize, page.TotalItems);
    }

    public async Task<JoinRequestModel> GetAsync(Guid requestId, CancellationToken cancellationToken)
    {
        var row = await joinRequests.FindRowAsync(requestId, cancellationToken) ?? throw new NotFoundException("JoinRequest", requestId);
        if (!currentUser.IsInRole(Roles.Administrator))
        {
            var userId = currentUser.RequireUserId();
            if (row.Request.StudentId != userId && row.LeaderId != userId)
            {
                throw new ForbiddenException("Only the applicant, the room leader and administrators can see this application.");
            }
        }

        return (await ToModelsAsync([row], cancellationToken))[0];
    }

    public async Task<JoinRequestModel> SubmitAsync(Guid roomId, string? message, CancellationToken cancellationToken)
    {
        var studentId = currentUser.RequireUserId();
        var text = Normalize(message, "message");
        var requestId = Guid.NewGuid();
        await transactions.ExecuteWithConflictRetryAsync(
            async token =>
            {
                var (room, course) = await seating.LoadAsync(roomId, token);
                await seating.EnsureCanEnterAsync(room, course, studentId, token);
                if (room.Status != RoomStatuses.Locked)
                {
                    throw RoomSeating.Conflict(GroupErrorCodes.RoomNotLocked, "The room is open: join it directly.");
                }

                await seating.EnsureSeatAsync(room, course, studentId, token);
                if (await joinRequests.HasPendingAsync(roomId, studentId, token))
                {
                    throw RoomSeating.Conflict(GroupErrorCodes.ApplicationPending, "You already have a pending application to this room.");
                }

                joinRequests.Add(new JoinRequest
                {
                    RequestId = requestId,
                    RoomId = room.RoomId,
                    CourseId = room.CourseId,
                    StudentId = studentId,
                    Message = text,
                    Status = JoinRequestStatuses.Pending,
                    CreatedAt = clock.UtcNow,
                });
                outbox.Enqueue(
                    GroupEventTypes.JoinRequestSubmitted,
                    requestId,
                    new JoinRequestSubmittedEvent(requestId, room.CourseId, room.RoomId, room.Name, studentId, room.LeaderId));
                await joinRequests.SaveChangesAsync(token);
                return true;
            },
            cancellationToken);
        return await GetAsync(requestId, cancellationToken);
    }

    public async Task<JoinRequestModel> WithdrawAsync(Guid requestId, CancellationToken cancellationToken)
    {
        var studentId = currentUser.RequireUserId();
        await transactions.ExecuteWithConflictRetryAsync(
            async token =>
            {
                var request = await joinRequests.FindAsync(requestId, token) ?? throw new NotFoundException("JoinRequest", requestId);
                if (request.StudentId != studentId)
                {
                    throw new ForbiddenException("Only the applicant can withdraw an application.");
                }

                var (_, course) = await seating.LoadAsync(request.RoomId, token);
                RoomSeating.EnsurePublished(course, clock.UtcNow);
                EnsurePending(request);
                await closer.CloseAsync([request], JoinRequestReasons.Withdrawn, studentId, token);
                await joinRequests.SaveChangesAsync(token);
                return true;
            },
            cancellationToken);
        return await GetAsync(requestId, cancellationToken);
    }

    public async Task<JoinRequestModel> ApproveAsync(Guid requestId, CancellationToken cancellationToken)
    {
        await DecideAsync(
            requestId,
            async (request, room, course, leaderId, token) =>
            {
                if (await rooms.FindActiveMembershipAsync(course.CourseId, request.StudentId, token) is not null)
                {
                    await closer.CloseAsync([request], JoinRequestReasons.JoinedAnotherRoom, null, token);
                    return;
                }

                switch (await seating.SeatProblemAsync(room, course, request.StudentId, token))
                {
                    case null:
                        break;
                    case GroupErrorCodes.RoomFull:
                        await closer.CloseAsync([request], JoinRequestReasons.RoomFull, leaderId, token);
                        return;
                    case GroupErrorCodes.CompositionRule:
                        await closer.CloseAsync([request], JoinRequestReasons.CompositionRule, leaderId, token);
                        return;
                    case var code:
                        throw RoomSeating.Conflict(code, "The applicant is no longer on the course roster.");
                }

                request.Status = JoinRequestStatuses.Approved;
                request.DecidedBy = leaderId;
                request.DecidedAt = clock.UtcNow;
                outbox.Enqueue(
                    GroupEventTypes.JoinRequestDecided,
                    request.RequestId,
                    new JoinRequestDecidedEvent(request.RequestId, request.CourseId, request.RoomId, room.Name, request.StudentId, request.Status, null));
                await seating.AddMemberAsync(room, course, request.StudentId, JoinMethods.Application, token);
            },
            cancellationToken);
        return await GetAsync(requestId, cancellationToken);
    }

    public async Task<JoinRequestModel> RejectAsync(Guid requestId, string? reasonText, CancellationToken cancellationToken)
    {
        var text = Normalize(reasonText, "reasonText");
        await DecideAsync(
            requestId,
            (request, _, _, leaderId, token) => closer.CloseAsync([request], JoinRequestReasons.RejectedByLeader, leaderId, token, text),
            cancellationToken);
        return await GetAsync(requestId, cancellationToken);
    }

    private async Task DecideAsync(Guid requestId, Func<JoinRequest, Room, Course, Guid, CancellationToken, Task> decide, CancellationToken cancellationToken)
    {
        var leaderId = currentUser.RequireUserId();
        await transactions.ExecuteWithConflictRetryAsync(
            async token =>
            {
                var request = await joinRequests.FindAsync(requestId, token) ?? throw new NotFoundException("JoinRequest", requestId);
                var (room, course) = await seating.LoadAsync(request.RoomId, token);
                if (room.LeaderId != leaderId)
                {
                    throw RoomService.NotLeader();
                }

                EnsurePending(request);
                RoomSeating.EnsurePublished(course, clock.UtcNow);
                await decide(request, room, course, leaderId, token);
                await joinRequests.SaveChangesAsync(token);
                return true;
            },
            cancellationToken);
    }

    private static void EnsurePending(JoinRequest request)
    {
        if (request.Status != JoinRequestStatuses.Pending)
        {
            throw RoomSeating.Conflict(GroupErrorCodes.RequestNotPending, $"The application is already {request.Status}.");
        }
    }

    private static string? Normalize(string? text, string field)
    {
        var value = text?.Trim();
        if (string.IsNullOrEmpty(value))
        {
            return null;
        }

        return value.Length <= MaxTextLength
            ? value
            : throw new ValidationFailedException(field, $"Use at most {MaxTextLength} characters.");
    }

    private async Task<List<JoinRequestModel>> ToModelsAsync(IReadOnlyList<JoinRequestRow> rows, CancellationToken cancellationToken)
    {
        var skills = new Dictionary<(Guid SemesterId, Guid StudentId), List<RoomSkillModel>>();
        foreach (var semester in rows.GroupBy(row => row.SemesterId))
        {
            var studentIds = semester.Select(row => row.Request.StudentId).Distinct().ToList();
            foreach (var rating in await joinRequests.ListSkillsAsync(semester.Key, studentIds, cancellationToken))
            {
                var key = (semester.Key, rating.StudentId);
                if (!skills.TryGetValue(key, out var list))
                {
                    skills[key] = list = [];
                }

                list.Add(new RoomSkillModel(rating.SkillCode, rating.Level));
            }
        }

        return rows.Select(row => ToModel(row, skills.GetValueOrDefault((row.SemesterId, row.Request.StudentId)) ?? [])).ToList();
    }

    private static JoinRequestModel ToModel(JoinRequestRow row, IReadOnlyList<RoomSkillModel> skills) =>
        new(
            row.Request.RequestId,
            row.Request.CourseId,
            row.Request.RoomId,
            row.RoomName,
            row.Request.StudentId,
            row.StudentCode,
            row.StudentName,
            row.MajorCode,
            skills,
            row.Request.Message,
            row.Request.Status,
            row.Request.ReasonCode,
            row.Request.ReasonText,
            row.Request.DecidedBy,
            row.Request.DecidedAt,
            row.Request.CreatedAt);
}
