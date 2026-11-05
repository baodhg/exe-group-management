using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.Repositories.Interfaces;

public interface ISkillRepository
{
    Task<PagedResult<Skill>> GetPageAsync(ListQuery query, CancellationToken cancellationToken);

    Task<Skill?> FindAsync(Guid skillId, CancellationToken cancellationToken);

    Task<bool> CodeExistsAsync(string code, Guid? exceptSkillId, CancellationToken cancellationToken);

    Task<bool> IsInUseAsync(Guid skillId, CancellationToken cancellationToken);

    void Add(Skill skill);

    void Remove(Skill skill);

    Task SaveChangesAsync(CancellationToken cancellationToken);

    Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken);
}
