using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;

namespace ExeGroup.Group.IntegrationTests;

public sealed class SemestersEndpointTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private const string Route = "/api/v1/semesters";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private HttpClient Admin => fixture.Api.ClientAs(Roles.Administrator);

    private HttpClient Student => fixture.Api.ClientAs(Roles.Student);

    [Fact]
    public async Task An_administrator_creates_a_semester_and_gets_its_location()
    {
        var response = await Admin.PostAsJsonAsync(Route, NewSemester("FA26", "Fall 2026", "2026-09-01", "2026-12-31"), Ct);
        var body = await ReadAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("FA26", body.GetProperty("data").GetProperty("code").GetString());
        Assert.NotNull(response.Headers.Location);

        var fetched = await ReadAsync(await Admin.GetAsync(response.Headers.Location, Ct));
        Assert.Equal("Fall 2026", fetched.GetProperty("data").GetProperty("name").GetString());
    }

    [Fact]
    public async Task A_duplicate_code_is_a_conflict_with_a_business_code()
    {
        await Admin.PostAsJsonAsync(Route, NewSemester("SP26", "Spring 2026", "2026-01-05", "2026-04-30"), Ct);

        var response = await Admin.PostAsJsonAsync(Route, NewSemester("SP26", "Again", "2026-01-05", "2026-04-30"), Ct);
        var body = await ReadAsync(response);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("SEMESTER_CODE_TAKEN", FirstError(body).GetProperty("code").GetString());
    }

    [Theory]
    [InlineData("XX99", "Bad code", "2026-01-01", "2026-02-01", "code")]
    [InlineData("SU26", "", "2026-05-01", "2026-08-01", "name")]
    [InlineData("SU25", "Backwards", "2025-08-01", "2025-05-01", "endDate")]
    public async Task Invalid_input_is_rejected_with_the_offending_field(string code, string name, string start, string end, string field)
    {
        var response = await Admin.PostAsJsonAsync(Route, NewSemester(code, name, start, end), Ct);
        var body = await ReadAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(body.GetProperty("errors").EnumerateArray(), error => error.GetProperty("field").GetString() == field);
    }

    [Fact]
    public async Task Students_can_read_but_not_write()
    {
        var write = await Student.PostAsJsonAsync(Route, NewSemester("FA25", "Fall 2025", "2025-09-01", "2025-12-31"), Ct);
        var read = await Student.GetAsync(Route, Ct);

        Assert.Equal(HttpStatusCode.Forbidden, write.StatusCode);
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
    }

    [Fact]
    public async Task Anonymous_callers_are_rejected()
    {
        var response = await fixture.Api.AnonymousClient().GetAsync(Route, Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task The_list_supports_search_sort_paging_and_field_selection()
    {
        foreach (var (code, start) in new[] { ("SP24", "2024-01-05"), ("SU24", "2024-05-06"), ("FA24", "2024-09-02") })
        {
            await Admin.PostAsJsonAsync(Route, NewSemester(code, $"Year 2024 {code}", start, DateOnly.Parse(start).AddMonths(3).ToString("yyyy-MM-dd")), Ct);
        }

        var body = await ReadAsync(await Admin.GetAsync($"{Route}?search=2024&sort=-startDate&page=1&pageSize=2&fields=code,startDate", Ct));

        var data = body.GetProperty("data");
        Assert.Equal(["FA24", "SU24"], data.EnumerateArray().Select(item => item.GetProperty("code").GetString()));
        Assert.False(data[0].TryGetProperty("name", out _));
        var pagination = body.GetProperty("pagination");
        Assert.Equal(3, pagination.GetProperty("totalItems").GetInt32());
        Assert.Equal(2, pagination.GetProperty("totalPages").GetInt32());
    }

    [Fact]
    public async Task Sorting_by_an_unknown_field_is_a_validation_error()
    {
        var response = await Admin.GetAsync($"{Route}?sort=password", Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("sort", FirstError(await ReadAsync(response)).GetProperty("field").GetString());
    }

    [Fact]
    public async Task An_unknown_id_is_not_found()
    {
        var response = await Admin.GetAsync($"{Route}/{Guid.NewGuid()}", Ct);

        var error = FirstError(await ReadAsync(response));
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("NOT_FOUND", error.GetProperty("code").GetString());
        Assert.StartsWith("Semester '", error.GetProperty("message").GetString());
    }

    [Fact]
    public async Task An_administrator_updates_and_deletes_a_semester()
    {
        var created = await ReadAsync(await Admin.PostAsJsonAsync(Route, NewSemester("SU23", "Summer 2023", "2023-05-08", "2023-08-20"), Ct));
        var id = created.GetProperty("data").GetProperty("id").GetGuid();

        var updated = await Admin.PutAsJsonAsync($"{Route}/{id}", NewSemester("SU23", "Summer 2023 (updated)", "2023-05-08", "2023-08-27"), Ct);
        var deleted = await Admin.DeleteAsync($"{Route}/{id}", Ct);
        var afterDelete = await Admin.GetAsync($"{Route}/{id}", Ct);

        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        Assert.Equal("Summer 2023 (updated)", (await ReadAsync(updated)).GetProperty("data").GetProperty("name").GetString());
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, afterDelete.StatusCode);
    }

    [Fact]
    public async Task Renaming_a_code_onto_an_existing_one_is_a_conflict()
    {
        await Admin.PostAsJsonAsync(Route, NewSemester("FA23", "Fall 2023", "2023-09-04", "2023-12-24"), Ct);
        var other = await ReadAsync(await Admin.PostAsJsonAsync(Route, NewSemester("SP23", "Spring 2023", "2023-01-02", "2023-04-23"), Ct));
        var id = other.GetProperty("data").GetProperty("id").GetGuid();

        var response = await Admin.PutAsJsonAsync($"{Route}/{id}", NewSemester("FA23", "Spring 2023", "2023-01-02", "2023-04-23"), Ct);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Xml_is_served_when_asked_for()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, Route);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/xml"));

        var response = await Admin.SendAsync(request, Ct);
        var text = await response.Content.ReadAsStringAsync(Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("<pagination>", text);
    }

    private static object NewSemester(string code, string name, string start, string end) =>
        new { code, name, startDate = start, endDate = end };

    private static JsonElement FirstError(JsonElement body) => body.GetProperty("errors")[0];

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement;
}
