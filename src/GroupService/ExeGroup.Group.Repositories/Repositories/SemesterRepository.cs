using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Data;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Group.Repositories.Repositories;

public sealed class SemesterRepository(GroupDbContext context) : ISemesterRepository
{
    private static readonly SortMap<Semester> Sorting = new SortMap<Semester>()
        .Add("code", semester => semester.Code)
        .Add("name", semester => semester.Name)
        .Add("startDate", semester => semester.StartDate)
        .Add("endDate", semester => semester.EndDate)
        .ByDefault("startDate", descending: true)
        .TieBreaker(semester => semester.SemesterId);

    public Task<PagedResult<Semester>> GetPageAsync(ListQuery query, CancellationToken cancellationToken)
    {
        var semesters = context.Semesters.AsNoTracking();
        if (query.Search is { } search)
        {
            semesters = semesters.Where(semester => semester.Code.Contains(search) || semester.Name.Contains(search));
        }

        return semesters.ToPagedResultAsync(query, Sorting, cancellationToken);
    }

    public Task<Semester?> FindAsync(Guid semesterId, CancellationToken cancellationToken) =>
        context.Semesters.SingleOrDefaultAsync(semester => semester.SemesterId == semesterId, cancellationToken);

    public Task<bool> CodeExistsAsync(string code, Guid? exceptSemesterId, CancellationToken cancellationToken) =>
        context.Semesters.AnyAsync(
            semester => semester.Code == code && semester.SemesterId != exceptSemesterId,
            cancellationToken);

    public void Add(Semester semester) => context.Semesters.Add(semester);

    public void Remove(Semester semester) => context.Semesters.Remove(semester);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);
}
