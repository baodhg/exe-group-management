using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.Repositories.Interfaces;

public interface IMajorRepository
{
    Task<PagedResult<Major>> GetPageAsync(ListQuery query, CancellationToken cancellationToken);

    Task<Major?> FindAsync(Guid majorId, CancellationToken cancellationToken);

    Task<bool> CodeExistsAsync(string code, Guid? exceptMajorId, CancellationToken cancellationToken);

    Task<bool> IsInUseAsync(Guid majorId, CancellationToken cancellationToken);

    void Add(Major major);

    void Remove(Major major);

    Task SaveChangesAsync(CancellationToken cancellationToken);

    Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken);
}
