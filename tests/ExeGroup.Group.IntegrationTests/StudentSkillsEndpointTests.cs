using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.IntegrationTests;

public sealed class StudentSkillsEndpointTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task A_student_rates_skills_and_each_list_replaces_the_previous_one()
    {
        var studentId = Guid.NewGuid();
        Guid semesterId = Guid.Empty;
        Skill[] skills = [];
        await fixture.SeedAsync(
            database =>
            {
                var semester = database.Semester();
                database.Student(semester.SemesterId, database.Major().MajorId, studentId);
                skills = [database.Skill(), database.Skill(), database.Skill()];
                semesterId = semester.SemesterId;
            },
            Ct);
        var student = fixture.Api.ClientAs(Roles.Student, studentId);
        var route = $"/api/v1/semesters/{semesterId}/students/me";

        await student.PutAsJsonAsync($"{route}/skills", new[] { Rating(skills[0], 3), Rating(skills[1], 5) }, Ct);
        var replaced = await student.PutAsJsonAsync($"{route}/skills", new[] { Rating(skills[1], 4), Rating(skills[2], 1) }, Ct);
        var profile = await ReadAsync(await student.GetAsync(route, Ct));

        Assert.Equal(HttpStatusCode.OK, replaced.StatusCode);
        var levels = profile.Data().GetProperty("skills").EnumerateArray()
            .ToDictionary(skill => skill.GetProperty("skillId").GetGuid(), skill => skill.GetProperty("level").GetInt32());
        Assert.Equal(new Dictionary<Guid, int> { [skills[1].SkillId] = 4, [skills[2].SkillId] = 1 }, levels);
        Assert.False(profile.Data().GetProperty("skillsLocked").GetBoolean());
    }

    [Fact]
    public async Task Levels_outside_one_to_five_are_rejected()
    {
        var studentId = Guid.NewGuid();
        Guid semesterId = Guid.Empty, skillId = Guid.Empty;
        await fixture.SeedAsync(
            database =>
            {
                var semester = database.Semester();
                database.Student(semester.SemesterId, database.Major().MajorId, studentId);
                (semesterId, skillId) = (semester.SemesterId, database.Skill().SkillId);
            },
            Ct);

        var response = await fixture.Api.ClientAs(Roles.Student, studentId)
            .PutAsJsonAsync($"/api/v1/semesters/{semesterId}/students/me/skills", new[] { new { skillId, level = 6 } }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("VALIDATION_FAILED", (await ReadAsync(response)).GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Fact]
    public async Task Someone_outside_the_semester_has_no_profile_and_lecturers_cannot_rate()
    {
        var semesterId = Guid.Empty;
        await fixture.SeedAsync(database => semesterId = database.Semester().SemesterId, Ct);
        var route = $"/api/v1/semesters/{semesterId}/students/me";

        var outsider = await fixture.Api.ClientAs(Roles.Student).GetAsync(route, Ct);
        var lecturer = await fixture.Api.ClientAs(Roles.Lecturer).PutAsJsonAsync($"{route}/skills", Array.Empty<object>(), Ct);

        Assert.Equal(HttpStatusCode.NotFound, outsider.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, lecturer.StatusCode);
    }

    [Fact]
    public async Task Skills_lock_once_a_course_of_the_semester_has_expired()
    {
        var studentId = Guid.NewGuid();
        Guid semesterId = Guid.Empty, skillId = Guid.Empty;
        await fixture.SeedAsync(
            database =>
            {
                var semester = database.Semester();
                var course = database.Course(semester.SemesterId, database.Subject().SubjectId);
                course.Phase = CoursePhases.Expired;
                database.Enroll(course, studentId);
                (semesterId, skillId) = (semester.SemesterId, database.Skill().SkillId);
            },
            Ct);
        var student = fixture.Api.ClientAs(Roles.Student, studentId);

        var rate = await student.PutAsJsonAsync($"/api/v1/semesters/{semesterId}/students/me/skills", new[] { new { skillId, level = 3 } }, Ct);
        var profile = await ReadAsync(await student.GetAsync($"/api/v1/semesters/{semesterId}/students/me", Ct));

        Assert.Equal(HttpStatusCode.Conflict, rate.StatusCode);
        Assert.Equal("SKILLS_LOCKED", (await ReadAsync(rate)).GetProperty("errors")[0].GetProperty("code").GetString());
        Assert.True(profile.Data().GetProperty("skillsLocked").GetBoolean());
    }

    private static object Rating(Skill skill, int level) => new { skillId = skill.SkillId, level };

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement;
}
