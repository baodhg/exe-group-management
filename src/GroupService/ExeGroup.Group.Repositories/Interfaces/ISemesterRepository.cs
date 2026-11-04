using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.Repositories.Interfaces;

public interface ISemesterRepository
{
    Task<PagedResult<Semester>> GetPageAsync(ListQuery query, CancellationToken cancellationToken);

    Task<Semester?> FindAsync(Guid semesterId, CancellationToken cancellationToken);

    Task<bool> CodeExistsAsync(string code, Guid? exceptSemesterId, CancellationToken cancellationToken);

    void Add(Semester semester);

    void Remove(Semester semester);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
