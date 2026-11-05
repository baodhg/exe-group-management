using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Data;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Group.Repositories.Repositories;

public sealed class GroupTypeRepository(GroupDbContext context) : IGroupTypeRepository
{
    private static readonly SortMap<GroupType> Sorting = new SortMap<GroupType>()
        .Add("code", groupType => groupType.Code)
        .Add("name", groupType => groupType.Name)
        .Add("minDistinctMajors", groupType => groupType.MinDistinctMajors)
        .ByDefault("code")
        .TieBreaker(groupType => groupType.GroupTypeId);

    public Task<PagedResult<GroupType>> GetPageAsync(ListQuery query, CancellationToken cancellationToken)
    {
        var groupTypes = context.GroupTypes.AsNoTracking().Include(groupType => groupType.Majors).AsQueryable();
        if (query.Search is { } search)
        {
            groupTypes = groupTypes.Where(groupType => groupType.Code.Contains(search) || groupType.Name.Contains(search));
        }

        return groupTypes.ToPagedResultAsync(query, Sorting, cancellationToken);
    }

    public Task<GroupType?> FindAsync(Guid groupTypeId, CancellationToken cancellationToken) =>
        context.GroupTypes.Include(groupType => groupType.Majors).SingleOrDefaultAsync(groupType => groupType.GroupTypeId == groupTypeId, cancellationToken);

    public Task<bool> CodeExistsAsync(string code, Guid? exceptGroupTypeId, CancellationToken cancellationToken) =>
        context.GroupTypes.AnyAsync(groupType => groupType.Code == code && groupType.GroupTypeId != exceptGroupTypeId, cancellationToken);

    public Task<bool> IsUsedByRoomsAsync(Guid groupTypeId, CancellationToken cancellationToken) =>
        context.Rooms.AnyAsync(room => room.GroupTypeId == groupTypeId, cancellationToken);

    public Task<List<Guid>> FindExistingIdsAsync(IReadOnlyCollection<Guid> groupTypeIds, CancellationToken cancellationToken) =>
        context.GroupTypes.Where(groupType => groupTypeIds.Contains(groupType.GroupTypeId)).Select(groupType => groupType.GroupTypeId).ToListAsync(cancellationToken);

    public Task<List<GroupType>> ListAllowedInSemesterAsync(Guid semesterId, CancellationToken cancellationToken) =>
        context.GroupTypes.AsNoTracking()
            .Include(groupType => groupType.Majors)
            .Where(groupType => context.SemesterGroupTypes.Any(link => link.SemesterId == semesterId && link.GroupTypeId == groupType.GroupTypeId))
            .OrderBy(groupType => groupType.Code)
            .ToListAsync(cancellationToken);

    public Task<List<SemesterGroupType>> ListSemesterLinksAsync(Guid semesterId, CancellationToken cancellationToken) =>
        context.SemesterGroupTypes.Where(link => link.SemesterId == semesterId).ToListAsync(cancellationToken);

    public Task<List<Guid>> FindUsedByRoomsInSemesterAsync(Guid semesterId, IReadOnlyCollection<Guid> groupTypeIds, CancellationToken cancellationToken) =>
        context.Rooms
            .Where(room => room.SemesterId == semesterId && groupTypeIds.Contains(room.GroupTypeId))
            .Select(room => room.GroupTypeId)
            .Distinct()
            .ToListAsync(cancellationToken);

    public Task<Dictionary<Guid, Major>> FindMajorsAsync(IReadOnlyCollection<Guid> majorIds, CancellationToken cancellationToken) =>
        context.Majors.AsNoTracking().Where(major => majorIds.Contains(major.MajorId)).ToDictionaryAsync(major => major.MajorId, cancellationToken);

    public void Add(GroupType groupType) => context.GroupTypes.Add(groupType);

    public void Remove(GroupType groupType) => context.GroupTypes.Remove(groupType);

    public void RemoveMajor(GroupTypeMajor rule) => context.GroupTypeMajors.Remove(rule);

    public void AddSemesterLink(SemesterGroupType link) => context.SemesterGroupTypes.Add(link);

    public void RemoveSemesterLink(SemesterGroupType link) => context.SemesterGroupTypes.Remove(link);

    public async Task RemoveAllSemesterLinksAsync(Guid groupTypeId, CancellationToken cancellationToken) =>
        context.SemesterGroupTypes.RemoveRange(
            await context.SemesterGroupTypes.Where(link => link.GroupTypeId == groupTypeId).ToListAsync(cancellationToken));

    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);

    public Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken) => context.TrySaveChangesAsync(cancellationToken);
}
