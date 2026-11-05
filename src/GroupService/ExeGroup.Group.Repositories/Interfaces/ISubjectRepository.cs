using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.Repositories.Interfaces;

public interface ISubjectRepository
{
    Task<PagedResult<Subject>> GetPageAsync(ListQuery query, CancellationToken cancellationToken);

    Task<Subject?> FindAsync(Guid subjectId, CancellationToken cancellationToken);

    Task<bool> CodeExistsAsync(string code, Guid? exceptSubjectId, CancellationToken cancellationToken);

    Task<bool> IsInUseAsync(Guid subjectId, CancellationToken cancellationToken);

    void Add(Subject subject);

    void Remove(Subject subject);

    Task SaveChangesAsync(CancellationToken cancellationToken);

    Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken);
}
