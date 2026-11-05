using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Data;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Group.Repositories.Repositories;

public sealed class SubjectRepository(GroupDbContext context) : ISubjectRepository
{
    private static readonly SortMap<Subject> Sorting = new SortMap<Subject>()
        .Add("code", subject => subject.Code)
        .Add("name", subject => subject.Name)
        .ByDefault("code")
        .TieBreaker(subject => subject.SubjectId);

    public Task<PagedResult<Subject>> GetPageAsync(ListQuery query, CancellationToken cancellationToken)
    {
        var items = context.Subjects.AsNoTracking();
        if (query.Search is { } search)
        {
            items = items.Where(subject => subject.Code.Contains(search) || subject.Name.Contains(search));
        }

        return items.ToPagedResultAsync(query, Sorting, cancellationToken);
    }

    public Task<Subject?> FindAsync(Guid subjectId, CancellationToken cancellationToken) =>
        context.Subjects.SingleOrDefaultAsync(subject => subject.SubjectId == subjectId, cancellationToken);

    public Task<bool> CodeExistsAsync(string code, Guid? exceptSubjectId, CancellationToken cancellationToken) =>
        context.Subjects.AnyAsync(subject => subject.Code == code && subject.SubjectId != exceptSubjectId, cancellationToken);

    public Task<bool> IsInUseAsync(Guid subjectId, CancellationToken cancellationToken) =>
        context.Courses.AnyAsync(course => course.SubjectId == subjectId, cancellationToken);

    public void Add(Subject subject) => context.Subjects.Add(subject);

    public void Remove(Subject subject) => context.Subjects.Remove(subject);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);

    public Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken) => context.TrySaveChangesAsync(cancellationToken);
}
