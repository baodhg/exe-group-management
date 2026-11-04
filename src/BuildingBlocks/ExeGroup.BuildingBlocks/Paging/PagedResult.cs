namespace ExeGroup.BuildingBlocks.Paging;

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalItems)
{
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalItems / (double)PageSize);

    public PagedResult<TOut> Map<TOut>(Func<T, TOut> map) =>
        new(Items.Select(map).ToList(), Page, PageSize, TotalItems);
}
