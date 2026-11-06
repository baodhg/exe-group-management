using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Data;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Group.Repositories.Repositories;

public sealed class JoinRequestRepository(GroupDbContext context) : IJoinRequestRepository
{
    private static readonly SortMap<JoinRequestRow> Sorting = new SortMap<JoinRequestRow>()
        .Add("createdAt", row => row.Request.CreatedAt)
        .Add("decidedAt", row => row.Request.DecidedAt)
        .Add("status", row => row.Request.Status)
        .Add("roomName", row => row.RoomName)
        .Add("studentCode", row => row.StudentCode)
        .ByDefault("createdAt", descending: true)
        .TieBreaker(row => row.Request.RequestId);

    public Task<PagedResult<JoinRequestRow>> GetPageAsync(JoinRequestFilter filter, ListQuery query, CancellationToken cancellationToken)
    {
        var requests = context.JoinRequests.AsNoTracking();
        if (filter.StudentId is { } studentId)
        {
            requests = requests.Where(request => request.StudentId == studentId);
        }

        if (filter.RoomId is { } roomId)
        {
            requests = requests.Where(request => request.RoomId == roomId);
        }

        if (filter.CourseId is { } courseId)
        {
            requests = requests.Where(request => request.CourseId == courseId);
        }

        if (filter.Status is { } status)
        {
            requests = requests.Where(request => request.Status == status);
        }

        var rows = Rows(requests);
        if (query.Search is { } search)
        {
            rows = rows.Where(row =>
                row.RoomName.Contains(search)
                || (row.StudentCode != null && row.StudentCode.Contains(search))
                || (row.StudentName != null && row.StudentName.Contains(search))
                || (row.Request.Message != null && row.Request.Message.Contains(search)));
        }

        return rows.ToPagedResultAsync(query, Sorting, cancellationToken);
    }

    public Task<JoinRequestRow?> FindRowAsync(Guid requestId, CancellationToken cancellationToken) =>
        Rows(context.JoinRequests.AsNoTracking().Where(request => request.RequestId == requestId)).SingleOrDefaultAsync(cancellationToken);

    public Task<JoinRequest?> FindAsync(Guid requestId, CancellationToken cancellationToken) =>
        context.JoinRequests.SingleOrDefaultAsync(request => request.RequestId == requestId, cancellationToken);

    public Task<bool> HasPendingAsync(Guid roomId, Guid studentId, CancellationToken cancellationToken) =>
        context.JoinRequests.AnyAsync(
            request => request.RoomId == roomId && request.StudentId == studentId && request.Status == JoinRequestStatuses.Pending,
            cancellationToken);

    public void Add(JoinRequest request) => context.JoinRequests.Add(request);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);

    private IQueryable<JoinRequestRow> Rows(IQueryable<JoinRequest> requests) =>
        from request in requests
        join room in context.Rooms on request.RoomId equals room.RoomId
        join student in context.SemesterStudents on new { room.SemesterId, request.StudentId } equals new { student.SemesterId, student.StudentId } into students
        from student in students.DefaultIfEmpty()
        select new JoinRequestRow
        {
            Request = request,
            RoomName = room.Name,
            LeaderId = room.LeaderId,
            StudentCode = student.StudentCode,
            StudentName = student.FullName,
        };
}
