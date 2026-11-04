using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.BuildingBlocks.Paging;

namespace ExeGroup.BuildingBlocks.Tests.Paging;

public sealed class SortMapTests
{
    private sealed record Item(string Code, DateOnly Start, int Members);

    private static readonly SortMap<Item> Map = new SortMap<Item>()
        .Add("code", item => item.Code)
        .Add("start", item => item.Start)
        .Add("members", item => item.Members)
        .ByDefault("code");

    private static readonly Item[] Items =
    [
        new("B", new DateOnly(2026, 1, 1), 3),
        new("A", new DateOnly(2026, 3, 1), 3),
        new("C", new DateOnly(2026, 2, 1), 5),
    ];

    [Fact]
    public void No_sort_uses_the_default_order()
    {
        var sorted = Items.AsQueryable().ApplySorting([], Map).Select(item => item.Code);

        Assert.Equal(["A", "B", "C"], sorted);
    }

    [Fact]
    public void Several_fields_apply_in_order_with_descending_support()
    {
        var sorted = Items.AsQueryable()
            .ApplySorting([new SortField("members", true), new SortField("start", false)], Map)
            .Select(item => item.Code);

        Assert.Equal(["C", "B", "A"], sorted);
    }

    [Fact]
    public void Field_names_are_matched_case_insensitively()
    {
        var sorted = Items.AsQueryable().ApplySorting([new SortField("CODE", true)], Map).Select(item => item.Code);

        Assert.Equal(["C", "B", "A"], sorted);
    }

    [Fact]
    public void Unknown_sort_field_is_rejected_and_lists_the_allowed_ones()
    {
        var error = Assert.Throws<ValidationFailedException>(
            () => Items.AsQueryable().ApplySorting([new SortField("password", false)], Map).ToList());

        var fieldError = Assert.Single(error.Errors);
        Assert.Equal("sort", fieldError.Field);
        Assert.Contains("code, start, members", fieldError.Message);
    }
}
