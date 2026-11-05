using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Data;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Group.Repositories.Repositories;

public sealed class MajorRepository(GroupDbContext context) : IMajorRepository
{
    private static readonly SortMap<Major> Sorting = new SortMap<Major>()
        .Add("code", major => major.Code)
        .Add("name", major => major.Name)
        .ByDefault("code")
        .TieBreaker(major => major.MajorId);

    public Task<PagedResult<Major>> GetPageAsync(ListQuery query, CancellationToken cancellationToken)
    {
        var items = context.Majors.AsNoTracking();
        if (query.Search is { } search)
        {
            items = items.Where(major => major.Code.Contains(search) || major.Name.Contains(search));
        }

        return items.ToPagedResultAsync(query, Sorting, cancellationToken);
    }

    public Task<Major?> FindAsync(Guid majorId, CancellationToken cancellationToken) =>
        context.Majors.SingleOrDefaultAsync(major => major.MajorId == majorId, cancellationToken);

    public Task<bool> CodeExistsAsync(string code, Guid? exceptMajorId, CancellationToken cancellationToken) =>
        context.Majors.AnyAsync(major => major.Code == code && major.MajorId != exceptMajorId, cancellationToken);

    public async Task<bool> IsInUseAsync(Guid majorId, CancellationToken cancellationToken) =>
        await context.SemesterStudents.AnyAsync(student => student.MajorId == majorId, cancellationToken)
        || await context.GroupTypeMajors.AnyAsync(rule => rule.MajorId == majorId, cancellationToken);

    public void Add(Major major) => context.Majors.Add(major);

    public void Remove(Major major) => context.Majors.Remove(major);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);

    public Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken) => context.TrySaveChangesAsync(cancellationToken);
}
