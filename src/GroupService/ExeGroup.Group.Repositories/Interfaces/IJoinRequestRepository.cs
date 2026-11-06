using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.Repositories.Interfaces;

public sealed class JoinRequestRow
{
    public required JoinRequest Request { get; init; }

    public required string RoomName { get; init; }

    public Guid? LeaderId { get; init; }

    public string? StudentCode { get; init; }

    public string? StudentName { get; init; }

    public Guid SemesterId { get; init; }

    public string? MajorCode { get; init; }
}

public sealed record StudentSkillRow(Guid StudentId, string SkillCode, byte Level);

public sealed record JoinRequestFilter(Guid? StudentId, Guid? RoomId, Guid? CourseId, string? Status);

public interface IJoinRequestRepository
{
    Task<PagedResult<JoinRequestRow>> GetPageAsync(JoinRequestFilter filter, ListQuery query, CancellationToken cancellationToken);

    Task<JoinRequestRow?> FindRowAsync(Guid requestId, CancellationToken cancellationToken);

    Task<JoinRequest?> FindAsync(Guid requestId, CancellationToken cancellationToken);

    Task<List<StudentSkillRow>> ListSkillsAsync(Guid semesterId, IReadOnlyCollection<Guid> studentIds, CancellationToken cancellationToken);

    Task<bool> HasPendingAsync(Guid roomId, Guid studentId, CancellationToken cancellationToken);

    void Add(JoinRequest request);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
