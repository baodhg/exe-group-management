using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.BuildingBlocks.Paging;

namespace ExeGroup.BuildingBlocks.Tests.Paging;

public sealed class ListQueryTests
{
    [Fact]
    public void Missing_page_and_page_size_fall_back_to_the_defaults()
    {
        var query = ListQuery.Create(search: null, sort: null, page: null, pageSize: null);

        Assert.Equal(1, query.Page);
        Assert.Equal(ListQuery.DefaultPageSize, query.PageSize);
        Assert.Equal(20, ListQuery.DefaultPageSize);
    }

    [Theory]
    [InlineData(500, 100)]
    [InlineData(101, 100)]
    [InlineData(100, 100)]
    [InlineData(0, 20)]
    [InlineData(-3, 20)]
    [InlineData(7, 7)]
    public void Page_size_is_clamped_instead_of_rejected(int requested, int expected)
    {
        Assert.Equal(expected, ListQuery.Create(null, null, 1, requested).PageSize);
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(-5, 1)]
    [InlineData(3, 3)]
    public void Page_below_one_starts_from_the_first_page(int requested, int expected)
    {
        Assert.Equal(expected, ListQuery.Create(null, null, requested, 10).Page);
    }

    [Fact]
    public void Sort_accepts_several_fields_and_a_minus_for_descending()
    {
        var query = ListQuery.Create(null, " -startDate, code ,", 1, 10);

        Assert.Equal(
            [new SortField("startDate", Descending: true), new SortField("code", Descending: false)],
            query.Sort);
    }

    [Theory]
    [InlineData("code;drop")]
    [InlineData("-")]
    [InlineData("--code")]
    public void Malformed_sort_is_a_validation_error_on_the_sort_field(string sort)
    {
        var error = Assert.Throws<ValidationFailedException>(() => ListQuery.Create(null, sort, 1, 10));

        Assert.Equal("sort", Assert.Single(error.Errors).Field);
    }

    [Fact]
    public void Search_is_trimmed_and_blank_search_means_no_filter()
    {
        Assert.Equal("nguyen", ListQuery.Create("  nguyen ", null, 1, 10).Search);
        Assert.Null(ListQuery.Create("   ", null, 1, 10).Search);
    }

    [Fact]
    public void Fields_and_expand_are_case_insensitive_sets()
    {
        var query = ListQuery.Create(null, null, 1, 10, fields: "code, Name", expand: "Semester");

        Assert.True(query.Fields.Contains("name"));
        Assert.True(query.Expands("semester"));
        Assert.False(query.Expands("course"));
    }

    [Theory]
    [InlineData(0, 10, 0)]
    [InlineData(1, 10, 1)]
    [InlineData(10, 10, 1)]
    [InlineData(11, 10, 2)]
    public void Total_pages_rounds_up(int totalItems, int pageSize, int expectedPages)
    {
        var page = new PagedResult<int>([], Page: 1, PageSize: pageSize, TotalItems: totalItems);

        Assert.Equal(expectedPages, page.TotalPages);
    }

    [Fact]
    public void Mapping_a_page_keeps_its_metadata()
    {
        var page = new PagedResult<int>([1, 2], Page: 2, PageSize: 2, TotalItems: 5);

        var mapped = page.Map(value => value.ToString());

        Assert.Equal(["1", "2"], mapped.Items);
        Assert.Equal((2, 2, 5, 3), (mapped.Page, mapped.PageSize, mapped.TotalItems, mapped.TotalPages));
    }
}
