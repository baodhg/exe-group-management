using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.Repositories.Interfaces;

public interface IGroupTypeRepository
{
    Task<PagedResult<GroupType>> GetPageAsync(ListQuery query, CancellationToken cancellationToken);

    Task<GroupType?> FindAsync(Guid groupTypeId, CancellationToken cancellationToken);

    Task<bool> CodeExistsAsync(string code, Guid? exceptGroupTypeId, CancellationToken cancellationToken);

    Task<bool> IsUsedByRoomsAsync(Guid groupTypeId, CancellationToken cancellationToken);

    Task<List<Guid>> FindExistingIdsAsync(IReadOnlyCollection<Guid> groupTypeIds, CancellationToken cancellationToken);

    Task<List<GroupType>> ListAllowedInSemesterAsync(Guid semesterId, CancellationToken cancellationToken);

    Task<List<SemesterGroupType>> ListSemesterLinksAsync(Guid semesterId, CancellationToken cancellationToken);

    Task<List<Guid>> FindUsedByRoomsInSemesterAsync(Guid semesterId, IReadOnlyCollection<Guid> groupTypeIds, CancellationToken cancellationToken);

    Task<Dictionary<Guid, Major>> FindMajorsAsync(IReadOnlyCollection<Guid> majorIds, CancellationToken cancellationToken);

    void Add(GroupType groupType);

    void Remove(GroupType groupType);

    void RemoveMajor(GroupTypeMajor rule);

    void AddSemesterLink(SemesterGroupType link);

    void RemoveSemesterLink(SemesterGroupType link);

    Task RemoveAllSemesterLinksAsync(Guid groupTypeId, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);

    Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken);
}
