using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Data;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Group.Repositories.Repositories;

public sealed class SkillRepository(GroupDbContext context) : ISkillRepository
{
    private static readonly SortMap<Skill> Sorting = new SortMap<Skill>()
        .Add("code", skill => skill.Code)
        .Add("name", skill => skill.Name)
        .ByDefault("code")
        .TieBreaker(skill => skill.SkillId);

    public Task<PagedResult<Skill>> GetPageAsync(ListQuery query, CancellationToken cancellationToken)
    {
        var items = context.Skills.AsNoTracking();
        if (query.Search is { } search)
        {
            items = items.Where(skill => skill.Code.Contains(search) || skill.Name.Contains(search));
        }

        return items.ToPagedResultAsync(query, Sorting, cancellationToken);
    }

    public Task<Skill?> FindAsync(Guid skillId, CancellationToken cancellationToken) =>
        context.Skills.SingleOrDefaultAsync(skill => skill.SkillId == skillId, cancellationToken);

    public Task<bool> CodeExistsAsync(string code, Guid? exceptSkillId, CancellationToken cancellationToken) =>
        context.Skills.AnyAsync(skill => skill.Code == code && skill.SkillId != exceptSkillId, cancellationToken);

    public Task<bool> IsInUseAsync(Guid skillId, CancellationToken cancellationToken) =>
        context.StudentSkills.AnyAsync(rating => rating.SkillId == skillId, cancellationToken);

    public void Add(Skill skill) => context.Skills.Add(skill);

    public void Remove(Skill skill) => context.Skills.Remove(skill);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);

    public Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken) => context.TrySaveChangesAsync(cancellationToken);
}
