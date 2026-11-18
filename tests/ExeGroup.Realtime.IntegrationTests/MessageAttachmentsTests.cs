using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using ExeGroup.Realtime.Repositories.Entities;

namespace ExeGroup.Realtime.IntegrationTests;

public sealed class MessageAttachmentsTests(RealtimeApiFixture fixture) : IClassFixture<RealtimeApiFixture>
{
    private static readonly DateTime Start = new(2026, 9, 1, 8, 0, 0, DateTimeKind.Utc);
    private static readonly byte[] OnePixel = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82];

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task A_member_sends_a_message_with_an_image_and_the_room_can_read_it_back()
    {
        var member = Guid.NewGuid();
        var room = await NewRoomAsync([member]);

        var sent = await SendAsync(fixture.ClientFor(member), room, "Ảnh của nhóm", OnePixel);
        var message = (await BodyAsync(sent)).GetProperty("data");
        var attachment = Assert.Single(message.GetProperty("attachments").EnumerateArray());

        Assert.Equal(HttpStatusCode.Created, sent.StatusCode);
        Assert.Equal("Ảnh của nhóm", message.GetProperty("content").GetString());
        Assert.Equal("image/png", attachment.GetProperty("contentType").GetString());
        Assert.Equal("/api/v1/attachments/" + attachment.GetProperty("id").GetGuid(), attachment.GetProperty("url").GetString());

        var page = (await BodyAsync(await fixture.ClientFor(member).GetAsync($"/api/v1/conversations/{room}/messages", Ct)))
            .GetProperty("data").GetProperty("items")[0];
        Assert.Single(page.GetProperty("attachments").EnumerateArray());
    }

    [Fact]
    public async Task The_image_is_served_to_a_member_of_the_room()
    {
        var member = Guid.NewGuid();
        var room = await NewRoomAsync([member]);

        var sent = await SendAsync(fixture.ClientFor(member), room, null, OnePixel);
        var attachment = (await BodyAsync(sent)).GetProperty("data").GetProperty("attachments")[0];
        var id = attachment.GetProperty("id").GetGuid();

        var response = await fixture.ClientFor(member).GetAsync($"/api/v1/attachments/{id}", Ct);
        var bytes = await response.Content.ReadAsByteArrayAsync(Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/png", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(OnePixel, bytes);
    }

    [Fact]
    public async Task Someone_outside_the_room_cannot_read_the_image()
    {
        var member = Guid.NewGuid();
        var room = await NewRoomAsync([member]);

        var sent = await SendAsync(fixture.ClientFor(member), room, null, OnePixel);
        var id = (await BodyAsync(sent)).GetProperty("data").GetProperty("attachments")[0].GetProperty("id").GetGuid();

        var response = await fixture.ClientFor(Guid.NewGuid()).GetAsync($"/api/v1/attachments/{id}", Ct);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task A_message_with_only_an_image_is_accepted_and_one_with_nothing_is_not()
    {
        var member = Guid.NewGuid();
        var room = await NewRoomAsync([member]);

        var sent = await SendAsync(fixture.ClientFor(member), room, null, OnePixel);
        var blank = await SendAsync(fixture.ClientFor(member), room, "   ", OnePixel);
        var nothing = await SendAsync(fixture.ClientFor(member), room, "   ", []);

        Assert.Equal(HttpStatusCode.Created, sent.StatusCode);
        Assert.Equal(JsonValueKind.Null, (await BodyAsync(sent)).GetProperty("data").GetProperty("content").ValueKind);
        Assert.Equal(HttpStatusCode.Created, blank.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, nothing.StatusCode);
        Assert.Equal("VALIDATION_FAILED", await ErrorCodeAsync(nothing));
    }

    [Fact]
    public async Task A_file_that_is_not_an_image_is_refused()
    {
        var member = Guid.NewGuid();
        var room = await NewRoomAsync([member]);

        var response = await SendAsync(fixture.ClientFor(member), room, null, OnePixel, "application/pdf", "tailieu.pdf");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("VALIDATION_FAILED", await ErrorCodeAsync(response));
    }

    [Fact]
    public async Task A_former_member_cannot_send_an_image()
    {
        var former = Guid.NewGuid();
        var room = await NewRoomAsync([Guid.NewGuid()]);
        await fixture.SeedAsync(
            database => database.ConversationMembers.Add(new ConversationMember
            {
                ConversationId = room,
                UserId = former,
                JoinedAt = Start,
                LeftAt = Start.AddMinutes(3),
            }),
            Ct);

        var response = await SendAsync(fixture.ClientFor(former), room, null, OnePixel);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task A_deleted_message_hides_its_images()
    {
        var member = Guid.NewGuid();
        var room = await NewRoomAsync([member]);

        var sent = await SendAsync(fixture.ClientFor(member), room, null, OnePixel);
        var id = (await BodyAsync(sent)).GetProperty("data").GetProperty("id").GetGuid();
        await fixture.ClientFor(member).DeleteAsync($"/api/v1/messages/{id}", Ct);

        var item = (await BodyAsync(await fixture.ClientFor(member).GetAsync($"/api/v1/conversations/{room}/messages", Ct)))
            .GetProperty("data").GetProperty("items")[0];

        Assert.True(item.GetProperty("deleted").GetBoolean());
        Assert.Empty(item.GetProperty("attachments").EnumerateArray());
    }

    private async Task<Guid> NewRoomAsync(Guid[] members)
    {
        var conversationId = Guid.NewGuid();
        await fixture.SeedAsync(
            database =>
            {
                database.Conversations.Add(new Conversation { ConversationId = conversationId, CourseId = Guid.NewGuid(), Title = "Room 1" });
                database.ConversationMembers.AddRange(members.Select(member => new ConversationMember
                {
                    ConversationId = conversationId,
                    UserId = member,
                    JoinedAt = Start,
                }));
            },
            Ct);
        return conversationId;
    }

    private static async Task<HttpResponseMessage> SendAsync(
        HttpClient client,
        Guid conversationId,
        string? content,
        byte[] data,
        string contentType = "image/png",
        string fileName = "hinh.png")
    {
        using var form = new MultipartFormDataContent();
        if (content is not null)
        {
            form.Add(new StringContent(content), "content");
        }

        if (data.Length > 0)
        {
            var file = new ByteArrayContent(data);
            file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
            form.Add(file, "files", fileName);
        }

        return await client.PostAsync($"/api/v1/conversations/{conversationId}/messages", form, Ct);
    }

    private static async Task<JsonElement> BodyAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement;

    private static async Task<string?> ErrorCodeAsync(HttpResponseMessage response) =>
        (await BodyAsync(response)).GetProperty("errors")[0].GetProperty("code").GetString();
}
