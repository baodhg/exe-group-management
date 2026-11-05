using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;

namespace ExeGroup.Group.IntegrationTests;

public sealed class GroupTypesEndpointTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private const string Route = "/api/v1/group-types";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private HttpClient Admin => fixture.Api.ClientAs(Roles.Administrator);

    [Fact]
    public async Task An_administrator_sets_the_minimum_members_per_major()
    {
        var se = await CreateMajorAsync("A");
        var ai = await CreateMajorAsync("B");
        var id = await CreateGroupTypeAsync(minDistinctMajors: 2);

        var first = await ReadAsync(await Admin.PutAsJsonAsync($"{Route}/{id}/majors", new[] { new { majorId = ai, minMembers = 1 }, new { majorId = se, minMembers = 2 } }, Ct));
        var second = await ReadAsync(await Admin.PutAsJsonAsync($"{Route}/{id}/majors", new[] { new { majorId = ai, minMembers = 3 } }, Ct));
        var fetched = await ReadAsync(await Admin.GetAsync($"{Route}/{id}", Ct));

        Assert.Equal(new[] { se, ai }, Majors(first).Select(major => major.Id));
        Assert.Equal(new[] { (ai, 3) }, Majors(second).Select(major => (major.Id, major.MinMembers)));
        Assert.Equal(2, fetched.GetProperty("data").GetProperty("minDistinctMajors").GetInt32());
        Assert.Single(Majors(fetched));
    }

    [Fact]
    public async Task Rules_the_database_would_refuse_are_rejected_first()
    {
        var id = await CreateGroupTypeAsync();

        var noMajors = await Admin.PostAsJsonAsync(Route, new { code = NewCode(), name = "Zero", minDistinctMajors = 0 }, Ct);
        var zeroMembers = await Admin.PutAsJsonAsync($"{Route}/{id}/majors", new[] { new { majorId = await CreateMajorAsync("C"), minMembers = 0 } }, Ct);
        var unknownMajor = await Admin.PutAsJsonAsync($"{Route}/{id}/majors", new[] { new { majorId = Guid.NewGuid(), minMembers = 1 } }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, noMajors.StatusCode);
        Assert.Equal("minDistinctMajors", (await ReadAsync(noMajors)).GetProperty("errors")[0].GetProperty("field").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, zeroMembers.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, unknownMajor.StatusCode);
    }

    [Fact]
    public async Task A_taken_code_is_a_conflict_and_only_administrators_write()
    {
        var code = NewCode();
        await Admin.PostAsJsonAsync(Route, new { code, name = "One", minDistinctMajors = 1 }, Ct);

        var duplicate = await Admin.PostAsJsonAsync(Route, new { code, name = "Two", minDistinctMajors = 1 }, Ct);
        var byStudent = await fixture.Api.ClientAs(Roles.Student).PostAsJsonAsync(Route, new { code = NewCode(), name = "Three", minDistinctMajors = 1 }, Ct);

        Assert.Equal("GROUP_TYPE_CODE_TAKEN", (await ReadAsync(duplicate)).GetProperty("errors")[0].GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.Forbidden, byStudent.StatusCode);
    }

    [Fact]
    public async Task A_semester_allows_the_group_types_the_administrator_picks()
    {
        var semesterId = Guid.Empty;
        await fixture.SeedAsync(database => semesterId = database.Semester().SemesterId, Ct);
        var first = await CreateGroupTypeAsync();
        var second = await CreateGroupTypeAsync();
        var route = $"/api/v1/semesters/{semesterId}/group-types";

        var both = await ReadAsync(await Admin.PutAsJsonAsync(route, new { groupTypeIds = new[] { first, second, first } }, Ct));
        await Admin.PutAsJsonAsync(route, new { groupTypeIds = new[] { second } }, Ct);
        var after = await ReadAsync(await fixture.Api.ClientAs(Roles.Student).GetAsync(route, Ct));
        var missing = await Admin.GetAsync($"/api/v1/semesters/{Guid.NewGuid()}/group-types", Ct);

        Assert.Equal(2, both.GetProperty("data").GetArrayLength());
        Assert.Equal(second, Assert.Single(after.GetProperty("data").EnumerateArray()).GetProperty("id").GetGuid());
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [Fact]
    public async Task A_group_type_used_by_rooms_stays_in_place()
    {
        Guid semesterId = Guid.Empty, groupTypeId = Guid.Empty;
        await fixture.SeedAsync(
            database =>
            {
                var semester = database.Semester();
                var course = database.Course(semester.SemesterId, database.Subject().SubjectId);
                var groupType = database.GroupType(semester.SemesterId);
                database.Room(course, groupType.GroupTypeId);
                (semesterId, groupTypeId) = (semester.SemesterId, groupType.GroupTypeId);
            },
            Ct);

        var delete = await Admin.DeleteAsync($"{Route}/{groupTypeId}", Ct);
        var disallow = await Admin.PutAsJsonAsync($"/api/v1/semesters/{semesterId}/group-types", new { groupTypeIds = Array.Empty<Guid>() }, Ct);

        Assert.Equal("GROUP_TYPE_IN_USE", (await ReadAsync(delete)).GetProperty("errors")[0].GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.Conflict, disallow.StatusCode);
    }

    [Fact]
    public async Task An_unused_group_type_is_deleted_with_its_rules_and_semester_links()
    {
        var semesterId = Guid.Empty;
        await fixture.SeedAsync(database => semesterId = database.Semester().SemesterId, Ct);
        var id = await CreateGroupTypeAsync();
        await Admin.PutAsJsonAsync($"{Route}/{id}/majors", new[] { new { majorId = await CreateMajorAsync("D"), minMembers = 1 } }, Ct);
        await Admin.PutAsJsonAsync($"/api/v1/semesters/{semesterId}/group-types", new { groupTypeIds = new[] { id } }, Ct);

        var deleted = await Admin.DeleteAsync($"{Route}/{id}", Ct);
        var afterDelete = await Admin.GetAsync($"{Route}/{id}", Ct);

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, afterDelete.StatusCode);
    }

    private async Task<Guid> CreateMajorAsync(string prefix)
    {
        var response = await Admin.PostAsJsonAsync("/api/v1/majors", new { code = $"{prefix}{Random.Shared.Next(100000, 999999)}", name = "Major" }, Ct);
        return (await ReadAsync(response)).GetProperty("data").GetProperty("id").GetGuid();
    }

    private async Task<Guid> CreateGroupTypeAsync(int minDistinctMajors = 1)
    {
        var response = await Admin.PostAsJsonAsync(Route, new { code = NewCode(), name = "Group type", minDistinctMajors }, Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadAsync(response)).GetProperty("data").GetProperty("id").GetGuid();
    }

    private static IEnumerable<(Guid Id, int MinMembers)> Majors(JsonElement body) =>
        body.GetProperty("data").GetProperty("majors").EnumerateArray()
            .Select(major => (major.GetProperty("majorId").GetGuid(), major.GetProperty("minMembers").GetInt32()));

    private static string NewCode() => $"GT{Guid.NewGuid():N}"[..12].ToUpperInvariant();

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement;
}
