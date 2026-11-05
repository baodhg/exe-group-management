using System.Text.RegularExpressions;
using ExeGroup.BuildingBlocks.Errors;

namespace ExeGroup.BuildingBlocks.Paging;

public sealed record SortField(string Field, bool Descending);

public sealed partial record ListQuery
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;
    public const int MaxPage = int.MaxValue / MaxPageSize;

    private ListQuery(
        string? search,
        IReadOnlyList<SortField> sort,
        int page,
        int pageSize,
        IReadOnlySet<string> fields,
        IReadOnlySet<string> expand)
    {
        Search = search;
        Sort = sort;
        Page = page;
        PageSize = pageSize;
        Fields = fields;
        Expand = expand;
    }

    public string? Search { get; }

    public IReadOnlyList<SortField> Sort { get; }

    public int Page { get; }

    public int PageSize { get; }

    public IReadOnlySet<string> Fields { get; }

    public IReadOnlySet<string> Expand { get; }

    public int Skip => (Page - 1) * PageSize;

    public bool Expands(string relation) => Expand.Contains(relation);

    public static ListQuery Default { get; } = Create(null, null, null, null);

    public static ListQuery Create(
        string? search,
        string? sort,
        int? page,
        int? pageSize,
        string? fields = null,
        string? expand = null)
    {
        return new ListQuery(
            string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
            ParseSort(sort),
            page switch
            {
                null or < 1 => 1,
                > MaxPage => MaxPage,
                _ => page.Value,
            },
            pageSize switch
            {
                null or < 1 => DefaultPageSize,
                > MaxPageSize => MaxPageSize,
                _ => pageSize.Value,
            },
            ParseSet(fields),
            ParseSet(expand));
    }

    private static IReadOnlyList<SortField> ParseSort(string? sort)
    {
        if (string.IsNullOrWhiteSpace(sort))
        {
            return [];
        }

        var fields = new List<SortField>();
        foreach (var token in sort.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
        {
            var descending = token.StartsWith('-');
            var name = descending ? token[1..] : token;
            if (!SortFieldName().IsMatch(name))
            {
                throw new ValidationFailedException(
                    "sort",
                    $"'{token}' is not a valid sort field. Use comma-separated names, prefix '-' for descending.");
            }

            fields.Add(new SortField(name, descending));
        }

        return fields;
    }

    private static IReadOnlySet<string> ParseSet(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            : value.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

    [GeneratedRegex("^[A-Za-z][A-Za-z0-9]*$")]
    private static partial Regex SortFieldName();
}
