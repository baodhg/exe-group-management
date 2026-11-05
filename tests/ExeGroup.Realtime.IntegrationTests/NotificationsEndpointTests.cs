using System.Net;
using System.Text.Json;
using ExeGroup.Realtime.Repositories.Entities;

namespace ExeGroup.Realtime.IntegrationTests;

public sealed class NotificationsEndpointTests(RealtimeApiFixture fixture) : IClassFixture<RealtimeApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Unread_notifications_can_be_read_one_by_one_or_all_at_once()
    {
        var user = Guid.NewGuid();
        var ids = await SeedAsync(user, count: 3);
        var client = fixture.ClientFor(user);

        var unread = await ListAsync(client, "unread=true");
        var readOne = await client.PostAsync($"/api/v1/notifications/{ids[0]}/read", null, Ct);
        var stillUnread = await ListAsync(client, "unread=true");
        var readAll = await BodyAsync(await client.PostAsync("/api/v1/notifications/read-all", null, Ct));
        var everything = await ListAsync(client, string.Empty);

        Assert.Equal(new[] { ids[2], ids[1], ids[0] }, unread);
        Assert.Equal(HttpStatusCode.OK, readOne.StatusCode);
        Assert.Equal(new[] { ids[2], ids[1] }, stillUnread);
        Assert.Equal(2, readAll.GetProperty("data").GetProperty("updated").GetInt32());
        Assert.Empty(await ListAsync(client, "unread=true"));
        Assert.Equal(3, everything.Length);
    }

    [Fact]
    public async Task Someone_else_cannot_read_my_notification()
    {
        var ids = await SeedAsync(Guid.NewGuid(), count: 1);

        var response = await fixture.ClientFor(Guid.NewGuid()).PostAsync($"/api/v1/notifications/{ids[0]}/read", null, Ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private async Task<Guid[]> SeedAsync(Guid user, int count)
    {
        var ids = Enumerable.Range(0, count).Select(_ => Guid.NewGuid()).ToArray();
        var start = new DateTime(2026, 9, 1, 8, 0, 0, DateTimeKind.Utc);
        await fixture.SeedAsync(
            database => database.Notifications.AddRange(ids.Select((id, index) => new Notification
            {
                NotificationId = id,
                UserId = user,
                Type = "ApplicationApproved",
                Title = $"Notification {index + 1}",
                Body = "Your application was approved.",
                CreatedAt = start.AddMinutes(index),
            })),
            Ct);
        return ids;
    }

    private static async Task<Guid[]> ListAsync(HttpClient client, string query)
    {
        var body = await BodyAsync(await client.GetAsync($"/api/v1/notifications?{query}", Ct));
        return body.GetProperty("data").EnumerateArray().Select(item => item.GetProperty("id").GetGuid()).ToArray();
    }

    private static async Task<JsonElement> BodyAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement;
}
