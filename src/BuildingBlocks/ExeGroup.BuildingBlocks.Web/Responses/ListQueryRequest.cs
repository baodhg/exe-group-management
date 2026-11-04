using ExeGroup.BuildingBlocks.Paging;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.BuildingBlocks.Web.Responses;

public class ListQueryRequest
{
    [FromQuery(Name = "search")]
    public string? Search { get; init; }

    [FromQuery(Name = "sort")]
    public string? Sort { get; init; }

    [FromQuery(Name = "page")]
    public int? Page { get; init; }

    [FromQuery(Name = "pageSize")]
    public int? PageSize { get; init; }

    [FromQuery(Name = "fields")]
    public string? Fields { get; init; }

    [FromQuery(Name = "expand")]
    public string? Expand { get; init; }

    public ListQuery ToListQuery() => ListQuery.Create(Search, Sort, Page, PageSize, Fields, Expand);
}
