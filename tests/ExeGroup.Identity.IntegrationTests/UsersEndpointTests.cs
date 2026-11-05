using System.Net;
using System.Net.Http.Json;
using ExeGroup.BuildingBlocks.Context;
using static ExeGroup.Identity.IntegrationTests.IdentityApi;

namespace ExeGroup.Identity.IntegrationTests;

public sealed class UsersEndpointTests(IdentityApiFixture fixture) : IClassFixture<IdentityApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private HttpClient Admin => fixture.Api.ClientAs(Roles.Administrator);

    [Fact]
    public async Task Only_an_administrator_manages_accounts()
    {
        var list = await fixture.Api.ClientAs(Roles.Student).GetAsync("/api/v1/users", Ct);
        var import = await fixture.Api.ClientAs(Roles.Lecturer).PostAsJsonAsync("/api/v1/users/import", new { students = Array.Empty<object>() }, Ct);

        Assert.Equal(HttpStatusCode.Forbidden, list.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, import.StatusCode);
    }

    [Fact]
    public async Task Accounts_are_found_by_role_and_search()
    {
        var tag = Guid.NewGuid().ToString("N")[..8];
        var lecturer = await fixture.CreateUserAsync($"lecturer.{tag}@fpt.edu.vn", Roles.Lecturer);
        await fixture.CreateUserAsync($"student.{tag}@fpt.edu.vn", Roles.Student);

        var body = await BodyAsync(await Admin.GetAsync($"/api/v1/users?role=lecturer&search={tag}", Ct));

        var found = Assert.Single(body.GetProperty("data").EnumerateArray());
        Assert.Equal(lecturer, found.GetProperty("id").GetGuid());
        Assert.Equal(1, body.GetProperty("pagination").GetProperty("totalItems").GetInt32());
    }

    [Fact]
    public async Task A_taken_e_mail_or_code_is_a_conflict_and_a_student_needs_a_code()
    {
        var email = NewEmail();
        await fixture.CreateUserAsync(email, userCode: "SE900001");

        var sameEmail = await Admin.PostAsJsonAsync("/api/v1/users", new { email, fullName = "X", userCode = "SE900002", password = Password, roles = new[] { Roles.Student } }, Ct);
        var sameCode = await Admin.PostAsJsonAsync("/api/v1/users", new { email = NewEmail(), fullName = "X", userCode = "se900001", password = Password, roles = new[] { Roles.Student } }, Ct);
        var noCode = await Admin.PostAsJsonAsync("/api/v1/users", new { email = NewEmail(), fullName = "X", password = Password, roles = new[] { Roles.Student } }, Ct);

        Assert.Equal(HttpStatusCode.Conflict, sameEmail.StatusCode);
        Assert.Equal("EMAIL_TAKEN", await ErrorCodeAsync(sameEmail));
        Assert.Equal("USER_CODE_TAKEN", await ErrorCodeAsync(sameCode));
        Assert.Equal(HttpStatusCode.BadRequest, noCode.StatusCode);
    }

    [Fact]
    public async Task Importing_the_same_students_again_updates_them_instead_of_duplicating()
    {
        var first = NewEmail();
        var second = NewEmail();
        var codes = new[] { $"SE{Random.Shared.Next(100000, 999999)}", $"SA{Random.Shared.Next(100000, 999999)}" };
        object Students(string name) => new
        {
            defaultPassword = Password,
            students = new[]
            {
                new { email = first, fullName = name, userCode = codes[0] },
                new { email = second, fullName = name, userCode = codes[1] },
            },
        };

        var created = await BodyAsync(await Admin.PostAsJsonAsync("/api/v1/users/import", Students("Old Name"), Ct));
        var again = await BodyAsync(await Admin.PostAsJsonAsync("/api/v1/users/import", Students("New Name"), Ct));
        var firstId = created.GetProperty("data")[0].GetProperty("userId").GetGuid();
        var stored = await BodyAsync(await Admin.GetAsync($"/api/v1/users/{firstId}", Ct));

        Assert.All(created.GetProperty("data").EnumerateArray(), account => Assert.True(account.GetProperty("created").GetBoolean()));
        Assert.All(again.GetProperty("data").EnumerateArray(), account => Assert.False(account.GetProperty("created").GetBoolean()));
        Assert.Equal(firstId, again.GetProperty("data")[0].GetProperty("userId").GetGuid());
        Assert.Equal("New Name", stored.GetProperty("data").GetProperty("fullName").GetString());
        Assert.Equal(HttpStatusCode.OK, (await fixture.LoginAsync(second)).StatusCode);
    }
}
