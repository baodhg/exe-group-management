using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ExeGroup.Realtime.Repositories.Entities;

namespace ExeGroup.Realtime.IntegrationTests;

public sealed class ConversationsEndpointTests(RealtimeApiFixture fixture) : IClassFixture<RealtimeApiFixture>
{
    private static readonly DateTime Start = new(2026, 9, 1, 8, 0, 0, DateTimeKind.Utc);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Someone_outside_the_room_cannot_read_or_send_messages()
    {
        var room = await NewRoomAsync([Guid.NewGuid()], messages: 1);
        var outsider = fixture.ClientFor(Guid.NewGuid());

        var read = await outsider.GetAsync($"/api/v1/conversations/{room.Id}/messages", Ct);
        var send = await outsider.PostAsJsonAsync($"/api/v1/conversations/{room.Id}/messages", new { content = "hi" }, Ct);
        var missing = await outsider.GetAsync($"/api/v1/conversations/{Guid.NewGuid()}/messages", Ct);

        Assert.Equal(HttpStatusCode.Forbidden, read.StatusCode);
        Assert.Equal("FORBIDDEN", await ErrorCodeAsync(read));
        Assert.Equal(HttpStatusCode.Forbidden, send.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [Fact]
    public async Task Messages_come_newest_first_and_before_pages_back_in_order()
    {
        var member = Guid.NewGuid();
        var room = await NewRoomAsync([member], messages: 5);
        var client = fixture.ClientFor(member);

        var first = await PageAsync(client, room.Id, "pageSize=2");
        var second = await PageAsync(client, room.Id, $"pageSize=2&before={first.NextBefore}");
        var last = await PageAsync(client, room.Id, $"pageSize=2&before={second.NextBefore}");

        Assert.Equal(new[] { room.Messages[4], room.Messages[3] }, first.Ids);
        Assert.Equal(room.Messages[3], first.NextBefore);
        Assert.Equal(new[] { room.Messages[2], room.Messages[1] }, second.Ids);
        Assert.Equal(new[] { room.Messages[0] }, last.Ids);
        Assert.Null(last.NextBefore);
    }

    [Fact]
    public async Task A_former_member_reads_what_was_sent_before_leaving_and_cannot_send()
    {
        var former = Guid.NewGuid();
        var room = await NewRoomAsync([Guid.NewGuid()], messages: 5);
        await fixture.SeedAsync(
            database => database.ConversationMembers.Add(new ConversationMember
            {
                ConversationId = room.Id,
                UserId = former,
                JoinedAt = Start,
                LeftAt = Start.AddMinutes(3).AddSeconds(30),
            }),
            Ct);
        var client = fixture.ClientFor(former);

        var page = await PageAsync(client, room.Id, "pageSize=10");
        var send = await client.PostAsJsonAsync($"/api/v1/conversations/{room.Id}/messages", new { content = "still here?" }, Ct);

        Assert.Equal(new[] { room.Messages[2], room.Messages[1], room.Messages[0] }, page.Ids);
        Assert.Equal(HttpStatusCode.Forbidden, send.StatusCode);
    }

    [Fact]
    public async Task A_member_sends_a_message_and_only_the_sender_can_delete_it()
    {
        var sender = Guid.NewGuid();
        var other = Guid.NewGuid();
        var room = await NewRoomAsync([sender, other], messages: 0);

        var sent = await fixture.ClientFor(sender, "Nguyễn Văn An")
            .PostAsJsonAsync($"/api/v1/conversations/{room.Id}/messages", new { content = "  Chào cả nhóm  " }, Ct);
        var message = (await BodyAsync(sent)).GetProperty("data");
        var messageId = message.GetProperty("id").GetGuid();
        var deletedByOther = await fixture.ClientFor(other).DeleteAsync($"/api/v1/messages/{messageId}", Ct);
        var deletedBySender = await fixture.ClientFor(sender).DeleteAsync($"/api/v1/messages/{messageId}", Ct);
        var afterDelete = (await BodyAsync(await fixture.ClientFor(other).GetAsync($"/api/v1/conversations/{room.Id}/messages", Ct)))
            .GetProperty("data").GetProperty("items")[0];

        Assert.Equal(HttpStatusCode.Created, sent.StatusCode);
        Assert.Equal("Chào cả nhóm", message.GetProperty("content").GetString());
        Assert.Equal("Nguyễn Văn An", message.GetProperty("senderName").GetString());
        Assert.Equal(HttpStatusCode.Forbidden, deletedByOther.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, deletedBySender.StatusCode);
        Assert.True(afterDelete.GetProperty("deleted").GetBoolean());
        Assert.Equal(JsonValueKind.Null, afterDelete.GetProperty("content").ValueKind);
    }

    [Fact]
    public async Task An_empty_message_is_rejected()
    {
        var member = Guid.NewGuid();
        var room = await NewRoomAsync([member], messages: 0);

        var response = await fixture.ClientFor(member).PostAsJsonAsync($"/api/v1/conversations/{room.Id}/messages", new { content = "   " }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("VALIDATION_FAILED", await ErrorCodeAsync(response));
    }

    [Fact]
    public async Task My_conversations_show_the_last_message_I_can_see()
    {
        var member = Guid.NewGuid();
        var room = await NewRoomAsync([member], messages: 3);

        var body = await BodyAsync(await fixture.ClientFor(member).GetAsync("/api/v1/conversations", Ct));
        var conversation = Assert.Single(body.GetProperty("data").EnumerateArray());

        Assert.Equal(room.Id, conversation.GetProperty("id").GetGuid());
        Assert.True(conversation.GetProperty("canSend").GetBoolean());
        Assert.Equal(room.Messages[2], conversation.GetProperty("lastMessage").GetProperty("id").GetGuid());
    }

    private async Task<(Guid Id, Guid[] Messages)> NewRoomAsync(Guid[] members, int messages)
    {
        var conversationId = Guid.NewGuid();
        var messageIds = Enumerable.Range(0, messages).Select(_ => Guid.NewGuid()).ToArray();
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
                database.Messages.AddRange(messageIds.Select((id, index) => new Message
                {
                    MessageId = id,
                    ConversationId = conversationId,
                    SenderId = members[0],
                    SenderName = "Member",
                    Content = $"Message {index + 1}",
                    SentAt = Start.AddMinutes(index + 1),
                }));
            },
            Ct);
        return (conversationId, messageIds);
    }

    private static async Task<(Guid[] Ids, Guid? NextBefore)> PageAsync(HttpClient client, Guid conversationId, string query)
    {
        var response = await client.GetAsync($"/api/v1/conversations/{conversationId}/messages?{query}", Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var data = (await BodyAsync(response)).GetProperty("data");
        var next = data.GetProperty("nextBefore");
        return (
            data.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("id").GetGuid()).ToArray(),
            next.ValueKind == JsonValueKind.Null ? null : next.GetGuid());
    }

    private static async Task<JsonElement> BodyAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement;

    private static async Task<string?> ErrorCodeAsync(HttpResponseMessage response) =>
        (await BodyAsync(response)).GetProperty("errors")[0].GetProperty("code").GetString();
}
