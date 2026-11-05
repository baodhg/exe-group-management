using Microsoft.EntityFrameworkCore;

namespace ExeGroup.BuildingBlocks.Paging;

public static class QueryableExtensions
{
    public static IQueryable<T> ApplySorting<T>(this IQueryable<T> source, IReadOnlyList<SortField> sort, SortMap<T> map) =>
        map.Apply(source, sort);

    public static async Task<PagedResult<T>> ToPagedResultAsync<T>(
        this IQueryable<T> source,
        ListQuery query,
        SortMap<T> sortMap,
        CancellationToken cancellationToken = default)
    {
        if (!sortMap.HasDefault || !sortMap.HasTieBreaker)
        {
            throw new InvalidOperationException(
                $"SortMap<{typeof(T).Name}> needs ByDefault(...) and TieBreaker(unique key) so pages keep a stable order.");
        }

        var totalItems = await source.CountAsync(cancellationToken);
        var items = await source
            .ApplySorting(query.Sort, sortMap)
            .Skip(query.Skip)
            .Take(query.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<T>(items, query.Page, query.PageSize, totalItems);
    }
}
