using System.Net;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;

namespace ExeGroup.Group.IntegrationTests;

public sealed class SemesterDeletionTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task A_semester_with_courses_cannot_be_deleted()
    {
        var semesterId = Guid.Empty;
        await fixture.SeedAsync(
            database =>
            {
                var semester = database.Semester();
                database.Course(semester.SemesterId, database.Subject().SubjectId);
                semesterId = semester.SemesterId;
            },
            Ct);

        var response = await fixture.Api.ClientAs(Roles.Administrator).DeleteAsync($"/api/v1/semesters/{semesterId}", Ct);
        var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement;

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("SEMESTER_IN_USE", body.GetProperty("errors")[0].GetProperty("code").GetString());
    }
}
