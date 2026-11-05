using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.IntegrationTests;

public sealed class SkillsEndpointTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private const string Route = "/api/v1/skills";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private HttpClient Admin => fixture.Api.ClientAs(Roles.Administrator);

    [Fact]
    public async Task An_administrator_creates_reads_updates_and_deletes_a_skill()
    {
        var code = NewCode();
        var created = await Admin.PostAsJsonAsync(Route, new { code = code.ToLowerInvariant(), name = "  First name  " }, Ct);
        var body = await ReadAsync(created);
        var id = body.GetProperty("data").GetProperty("id").GetGuid();

        var fetched = await ReadAsync(await Admin.GetAsync(created.Headers.Location, Ct));
        var updated = await Admin.PutAsJsonAsync($"{Route}/{id}", new { code, name = "Second name" }, Ct);
        var deleted = await Admin.DeleteAsync($"{Route}/{id}", Ct);
        var afterDelete = await Admin.GetAsync($"{Route}/{id}", Ct);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(code, body.GetProperty("data").GetProperty("code").GetString());
        Assert.Equal("First name", fetched.GetProperty("data").GetProperty("name").GetString());
        Assert.Equal("Second name", (await ReadAsync(updated)).GetProperty("data").GetProperty("name").GetString());
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, afterDelete.StatusCode);
    }

    [Fact]
    public async Task A_taken_code_is_a_conflict_with_its_own_error_code()
    {
        var code = NewCode();
        await Admin.PostAsJsonAsync(Route, new { code, name = "One" }, Ct);

        var response = await Admin.PostAsJsonAsync(Route, new { code = code.ToLowerInvariant(), name = "Two" }, Ct);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("SKILL_CODE_TAKEN", (await ReadAsync(response)).GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Fact]
    public async Task A_skill_in_use_cannot_be_deleted()
    {
        var id = (await ReadAsync(await Admin.PostAsJsonAsync(Route, new { code = NewCode(), name = "Used" }, Ct))).GetProperty("data").GetProperty("id").GetGuid();
        await fixture.SeedAsync(
            database =>
            {
                var semester = database.Semester();
                var major = database.Major();
                var student = database.Student(semester.SemesterId, major.MajorId);
                database.StudentSkills.Add(new StudentSkill { SemesterId = semester.SemesterId, StudentId = student.StudentId, SkillId = id, Level = 3 });
            },
            Ct);

        var response = await Admin.DeleteAsync($"{Route}/{id}", Ct);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("SKILL_IN_USE", (await ReadAsync(response)).GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Theory]
    [InlineData("bad code!", "Valid name", "code")]
    [InlineData("OK1", "", "name")]
    public async Task Invalid_input_is_rejected_before_saving(string code, string name, string field)
    {
        var response = await Admin.PostAsJsonAsync(Route, new { code, name }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(field, (await ReadAsync(response)).GetProperty("errors")[0].GetProperty("field").GetString());
    }

    [Fact]
    public async Task Students_read_but_only_administrators_write()
    {
        var student = fixture.Api.ClientAs(Roles.Student);

        var write = await student.PostAsJsonAsync(Route, new { code = NewCode(), name = "Nope" }, Ct);
        var read = await student.GetAsync(Route, Ct);

        Assert.Equal(HttpStatusCode.Forbidden, write.StatusCode);
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
    }

    [Fact]
    public async Task The_list_searches_sorts_and_pages()
    {
        var tag = Guid.NewGuid().ToString("N")[..4].ToUpperInvariant();
        foreach (var name in new[] { "Gamma", "Alpha", "Beta" })
        {
            await Admin.PostAsJsonAsync(Route, new { code = NewCode(), name = $"{tag} {name}" }, Ct);
        }

        var body = await ReadAsync(await Admin.GetAsync($"{Route}?search={tag}&sort=-name&page=1&pageSize=2", Ct));
        var names = body.GetProperty("data").EnumerateArray().Select(item => item.GetProperty("name").GetString()).ToArray();

        Assert.Equal(new[] { $"{tag} Gamma", $"{tag} Beta" }, names);
        Assert.Equal(3, body.GetProperty("pagination").GetProperty("totalItems").GetInt32());
    }

    private static string NewCode() => $"C{Guid.NewGuid():N}"[..20].ToUpperInvariant();

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement;
}
