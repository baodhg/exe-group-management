using System.Net;
using System.Text;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.IntegrationTests;

public sealed class OfficialGroupsTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task The_lecturer_sees_the_official_groups_with_their_members()
    {
        var (first, second) = (Guid.NewGuid(), Guid.NewGuid());
        var scenario = await RoomScenario.CreateAsync(fixture, [(first, false), (second, false)], rooms: 1);
        var room = scenario.Rooms[0];
        await RoomScenario.As(fixture, first).PostAsync($"/api/v1/rooms/{room}/join", null, Ct);
        await RoomScenario.As(fixture, second).PostAsync($"/api/v1/rooms/{room}/join", null, Ct);

        var response = await fixture.Api.ClientAs(Roles.Lecturer, scenario.LecturerId).GetAsync($"/api/v1/courses/{scenario.CourseId}/groups", Ct);
        var body = await BodyAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var groups = body.GetProperty("data").GetProperty("groups");
        Assert.Single(groups.EnumerateArray());
        Assert.Equal(2, groups[0].GetProperty("members").GetArrayLength());
        Assert.Single(groups[0].GetProperty("members").EnumerateArray(), member => member.GetProperty("isLeader").GetBoolean());
    }

    [Fact]
    public async Task An_outsider_cannot_see_the_official_groups()
    {
        var scenario = await RoomScenario.CreateAsync(fixture, [(Guid.NewGuid(), false)], rooms: 1);
        var outsider = Guid.NewGuid();

        var response = await fixture.Api.ClientAs(Roles.Lecturer, outsider).GetAsync($"/api/v1/courses/{scenario.CourseId}/groups", Ct);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task The_export_gives_a_semicolon_separated_csv_with_a_byte_order_mark()
    {
        var student = Guid.NewGuid();
        var scenario = await RoomScenario.CreateAsync(fixture, [(student, false)], rooms: 1);
        var room = scenario.Rooms[0];
        await RoomScenario.As(fixture, student).PostAsync($"/api/v1/rooms/{room}/join", null, Ct);

        var response = await fixture.Api.ClientAs(Roles.Lecturer, scenario.LecturerId).GetAsync($"/api/v1/courses/{scenario.CourseId}/groups/export.csv", Ct);
        var bytes = await response.Content.ReadAsByteArrayAsync(Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/csv", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal([0xEF, 0xBB, 0xBF], bytes.Take(3));
        var text = Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3);
        Assert.Contains("Nhóm;Phòng;Đề tài;Trạng thái đề tài;Loại nhóm;Trưởng nhóm;Mã SV;Họ tên;Ngành;Vị trí", text, StringComparison.Ordinal);
        Assert.Contains("Trưởng nhóm", text, StringComparison.Ordinal);
    }

    private static async Task<JsonElement> BodyAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement;
}
