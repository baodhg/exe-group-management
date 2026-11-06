using System.Net;
using System.Net.Http.Json;
using ExeGroup.Realtime.API.Hubs;
using ExeGroup.Realtime.Repositories.Entities;
using ExeGroup.Realtime.Services.Notifications;
using ExeGroup.Realtime.Services.Push;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.Realtime.IntegrationTests;

public sealed class RealtimeHubTests(RealtimeApiFixture fixture) : IClassFixture<RealtimeApiFixture>
{
    private static readonly TimeSpan Quiet = TimeSpan.FromMilliseconds(700);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private IRealtimePush Push => fixture.Api.Services.GetRequiredService<IRealtimePush>();

    [Fact]
    public async Task Only_current_members_receive_the_messages_of_a_room()
    {
        var (alice, bob, outsider, former) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var conversation = await NewConversationAsync(Guid.NewGuid(), (alice, false), (bob, false), (former, true));
        await using var aliceHub = await fixture.HubFor(alice, "Alice");
        await using var bobHub = await fixture.HubFor(bob, "Bob");
        await using var outsiderHub = await fixture.HubFor(outsider);
        await using var formerHub = await fixture.HubFor(former);

        var sent = await aliceHub.InvokeAsync("sendMessage", conversation, "Hello room");
        var atBob = await bobHub.NextAsync(RealtimeHub.MessageReceived);
        var atAlice = await aliceHub.NextAsync(RealtimeHub.MessageReceived);
        var byRest = await fixture.ClientFor(bob, "Bob").PostAsJsonAsync($"/api/v1/conversations/{conversation}/messages", new { content = "Over REST" }, Ct);
        var restAtAlice = await aliceHub.NextAsync(RealtimeHub.MessageReceived);
        var refused = await Assert.ThrowsAsync<HubCallException>(() => outsiderHub.InvokeAsync("sendMessage", conversation, "Let me in"));

        Assert.Equal("Hello room", sent.GetProperty("content").GetString());
        Assert.Equal(("Hello room", "Alice"), (atBob.GetProperty("content").GetString(), atBob.GetProperty("senderName").GetString()));
        Assert.Equal(sent.GetProperty("id").GetGuid(), atAlice.GetProperty("id").GetGuid());
        Assert.Equal(HttpStatusCode.Created, byRest.StatusCode);
        Assert.Equal("Over REST", restAtAlice.GetProperty("content").GetString());
        Assert.Contains("FORBIDDEN: Only members of the room", refused.Message);
        Assert.False(await outsiderHub.ReceivesAsync(RealtimeHub.MessageReceived, Quiet));
        Assert.False(await formerHub.ReceivesAsync(RealtimeHub.MessageReceived, Quiet));
    }

    [Fact]
    public async Task Joining_or_leaving_a_room_chat_takes_effect_on_open_connections()
    {
        var (member, newcomer) = (Guid.NewGuid(), Guid.NewGuid());
        var conversation = await NewConversationAsync(Guid.NewGuid(), (member, false));
        await using var memberHub = await fixture.HubFor(member);
        await using var newcomerHub = await fixture.HubFor(newcomer);

        await fixture.SeedAsync(database => database.ConversationMembers.Add(new ConversationMember { ConversationId = conversation, UserId = newcomer, JoinedAt = DateTime.UtcNow }), Ct);
        await Push.JoinConversationAsync(newcomer, conversation, Ct);
        await Push.LeaveConversationAsync(member, conversation, Ct);
        await newcomerHub.InvokeAsync("sendMessage", conversation, "I am in");

        Assert.Equal("I am in", (await newcomerHub.NextAsync(RealtimeHub.MessageReceived)).GetProperty("content").GetString());
        Assert.False(await memberHub.ReceivesAsync(RealtimeHub.MessageReceived, Quiet));
    }

    [Fact]
    public async Task Notifications_go_to_their_user_and_room_changes_to_course_watchers()
    {
        var (owner, other) = (Guid.NewGuid(), Guid.NewGuid());
        var course = Guid.NewGuid();
        await using var ownerHub = await fixture.HubFor(owner);
        await using var otherHub = await fixture.HubFor(other);
        await otherHub.InvokeAsync("watchCourse", course);

        await Push.NotificationAsync(owner, new NotificationModel(Guid.NewGuid(), "JoinRequestDecided", "Approved", "You joined Room 01", DateTime.UtcNow, null, null, null), Ct);
        await Push.RoomChangedAsync(new RoomChangeModel(course, Guid.NewGuid(), "Room 01", "RoomMemberJoined"), Ct);

        var notification = await ownerHub.NextAsync(RealtimeHub.NotificationReceived);
        var change = await otherHub.NextAsync(RealtimeHub.RoomChanged);
        Assert.Equal("You joined Room 01", notification.GetProperty("body").GetString());
        Assert.Equal((course, "RoomMemberJoined"), (change.GetProperty("courseId").GetGuid(), change.GetProperty("eventType").GetString()));
        Assert.False(await otherHub.ReceivesAsync(RealtimeHub.NotificationReceived, Quiet));
        Assert.False(await ownerHub.ReceivesAsync(RealtimeHub.RoomChanged, Quiet));
    }

    [Fact]
    public async Task Connecting_without_a_token_is_refused()
    {
        var error = await Assert.ThrowsAnyAsync<Exception>(() => fixture.HubFor(null));

        Assert.Contains("401", error.Message);
    }

    private async Task<Guid> NewConversationAsync(Guid courseId, params (Guid UserId, bool Left)[] members)
    {
        var id = Guid.NewGuid();
        await fixture.SeedAsync(
            database =>
            {
                database.Conversations.Add(new Conversation { ConversationId = id, CourseId = courseId, Title = "Room 01", CreatedAt = DateTime.UtcNow });
                foreach (var (userId, left) in members)
                {
                    database.ConversationMembers.Add(new ConversationMember
                    {
                        ConversationId = id,
                        UserId = userId,
                        JoinedAt = DateTime.UtcNow.AddMinutes(-10),
                        LeftAt = left ? DateTime.UtcNow.AddMinutes(-5) : null,
                    });
                }
            },
            Ct);
        return id;
    }
}
