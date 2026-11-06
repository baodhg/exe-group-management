using System.Text.Json;
using ExeGroup.Realtime.API.Events;
using ExeGroup.Realtime.API.Hubs;
using ExeGroup.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using StackExchange.Redis;

namespace ExeGroup.Realtime.IntegrationTests;

public sealed class ConsumerFixture : RealtimeApiFixture
{
    private static readonly JsonSerializerOptions PayloadJson = new(JsonSerializerDefaults.Web);

    public IDatabase Redis => Api.Services.GetRequiredService<IConnectionMultiplexer>().GetDatabase();

    public GroupEventsConsumer Consumer(string stream, string name = GroupEventsConsumer.DefaultConsumer, int claimAfterSeconds = 60) =>
        new(
            Api.Services.GetRequiredService<IConnectionMultiplexer>(),
            Api.Services.GetRequiredService<IServiceScopeFactory>(),
            new ConfigurationBuilder()
                .AddInMemoryCollection(
                [
                    new(GroupEventsConsumer.StreamKey, stream),
                    new(GroupEventsConsumer.ConsumerKey, name),
                    new(GroupEventsConsumer.ClaimAfterKey, claimAfterSeconds.ToString(System.Globalization.CultureInfo.InvariantCulture)),
                ])
                .Build(),
            NullLogger<GroupEventsConsumer>.Instance);

    public Task AppendAsync(string stream, Guid eventId, string type, object payload) =>
        Redis.StreamAddAsync(
            stream,
            [
                new("eventId", eventId.ToString()),
                new("type", type),
                new("aggregateId", Guid.NewGuid().ToString()),
                new("payload", JsonSerializer.Serialize(payload, PayloadJson)),
                new("correlationId", "corr-test"),
                new("occurredAt", DateTime.UtcNow.ToString("O")),
            ]);

    protected override async Task<Dictionary<string, string?>> SettingsAsync()
    {
        var settings = await base.SettingsAsync();
        settings["Redis:Connection"] = (await RedisContainer.SharedAsync()).ConnectionString;
        return settings;
    }
}

public sealed class GroupEventsConsumerTests(ConsumerFixture fixture) : IClassFixture<ConsumerFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Events_build_the_room_chat_notify_users_and_reach_open_browsers()
    {
        var stream = NewStream();
        var (course, room, leader, member, applicant) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        await using var leaderHub = await fixture.HubFor(leader);
        await using var memberHub = await fixture.HubFor(member);
        await leaderHub.InvokeAsync("watchCourse", course);
        await fixture.AppendAsync(stream, Guid.NewGuid(), "RoomMemberJoined", new { courseId = course, roomId = room, roomName = "Room 01", studentId = leader, joinedVia = "Open", leaderId = leader });
        await fixture.AppendAsync(stream, Guid.NewGuid(), "RoomMemberJoined", new { courseId = course, roomId = room, roomName = "Room 01", studentId = member, joinedVia = "Open", leaderId = leader });
        await fixture.AppendAsync(stream, Guid.NewGuid(), "JoinRequestSubmitted", new { requestId = Guid.NewGuid(), courseId = course, roomId = room, roomName = "Room 01", studentId = applicant, leaderId = leader });
        await fixture.AppendAsync(stream, Guid.NewGuid(), "JoinRequestDecided", new { requestId = Guid.NewGuid(), courseId = course, roomId = room, roomName = "Room 01", studentId = applicant, status = "Approved", reasonCode = (string?)null });
        await fixture.AppendAsync(stream, Guid.NewGuid(), "RoomMemberLeft", new { courseId = course, roomId = room, roomName = "Room 01", studentId = member, endReason = "Removed", endNote = "Never came" });
        await fixture.AppendAsync(stream, Guid.NewGuid(), "CoursePhaseChanged", new { courseId = course, courseName = "PRN232 SE1801", phase = "Expired", lecturerId = Guid.NewGuid(), studentIds = new[] { leader, member, applicant } });

        var handled = await fixture.Consumer(stream).CatchUpAsync(Ct);

        Assert.Equal(6, handled);
        var conversation = await fixture.QueryAsync(database => database.Conversations.AsNoTracking().SingleAsync(item => item.ConversationId == room, Ct));
        Assert.Equal((course, "Room 01"), (conversation.CourseId, conversation.Title));
        var members = await fixture.QueryAsync(database => database.ConversationMembers.AsNoTracking().Where(item => item.ConversationId == room).ToDictionaryAsync(item => item.UserId, Ct));
        Assert.Null(members[leader].LeftAt);
        Assert.NotNull(members[member].LeftAt);
        var notices = await NoticesAsync(leader, member, applicant);
        Assert.Equal(new[] { "CoursePhaseChanged", "JoinRequestSubmitted", "RoomMemberJoined" }, notices[leader].Order());
        Assert.Equal(new[] { "CoursePhaseChanged", "RoomMemberLeft" }, notices[member].Order());
        Assert.Equal(new[] { "CoursePhaseChanged", "JoinRequestDecided" }, notices[applicant].Order());
        Assert.Equal(0, (await fixture.Redis.StreamPendingAsync(stream, GroupEventsConsumer.GroupName)).PendingMessageCount);

        var removal = await NextNotificationAsync(memberHub, "RoomMemberLeft");
        Assert.Equal("The leader removed you from Room 01: Never came", removal.GetProperty("body").GetString());
        var change = await leaderHub.NextAsync(RealtimeHub.RoomChanged);
        Assert.Equal(room, change.GetProperty("roomId").GetGuid());
        await leaderHub.InvokeAsync("sendMessage", room, "Welcome");
        Assert.Equal("Welcome", (await leaderHub.NextAsync(RealtimeHub.MessageReceived)).GetProperty("content").GetString());
    }

    [Fact]
    public async Task The_same_event_delivered_twice_notifies_once()
    {
        var stream = NewStream();
        var (eventId, applicant) = (Guid.NewGuid(), Guid.NewGuid());
        var payload = new { requestId = Guid.NewGuid(), courseId = Guid.NewGuid(), roomId = Guid.NewGuid(), roomName = "Room 02", studentId = applicant, status = "Rejected", reasonCode = "ROOM_FULL" };
        await fixture.AppendAsync(stream, eventId, "JoinRequestDecided", payload);
        await fixture.AppendAsync(stream, eventId, "JoinRequestDecided", payload);

        var handled = await fixture.Consumer(stream).CatchUpAsync(Ct);

        Assert.Equal(1, handled);
        Assert.Single((await NoticesAsync(applicant))[applicant]);
        Assert.Equal(1, await fixture.QueryAsync(database => database.ProcessedEvents.CountAsync(item => item.EventId == eventId, Ct)));
        Assert.Equal(0, (await fixture.Redis.StreamPendingAsync(stream, GroupEventsConsumer.GroupName)).PendingMessageCount);
    }

    [Fact]
    public async Task Events_left_unacknowledged_by_a_stopped_consumer_are_handled_after_a_restart()
    {
        var stream = NewStream();
        var (mine, orphan) = (Guid.NewGuid(), Guid.NewGuid());
        await fixture.Redis.StreamCreateConsumerGroupAsync(stream, GroupEventsConsumer.GroupName, StreamPosition.Beginning, createStream: true);
        await fixture.AppendAsync(stream, Guid.NewGuid(), "RoomLeaderChanged", new { courseId = Guid.NewGuid(), roomId = Guid.NewGuid(), roomName = "Room 03", leaderId = mine });
        await fixture.Redis.StreamReadGroupAsync(stream, GroupEventsConsumer.GroupName, GroupEventsConsumer.DefaultConsumer, StreamPosition.NewMessages, 10);
        await fixture.AppendAsync(stream, Guid.NewGuid(), "RoomLeaderChanged", new { courseId = Guid.NewGuid(), roomId = Guid.NewGuid(), roomName = "Room 04", leaderId = orphan });
        await fixture.Redis.StreamReadGroupAsync(stream, GroupEventsConsumer.GroupName, "realtime-gone", StreamPosition.NewMessages, 10);

        var handled = await fixture.Consumer(stream, claimAfterSeconds: 0).CatchUpAsync(Ct);

        Assert.Equal(2, handled);
        var notices = await NoticesAsync(mine, orphan);
        Assert.Single(notices[mine]);
        Assert.Single(notices[orphan]);
        Assert.Equal(0, (await fixture.Redis.StreamPendingAsync(stream, GroupEventsConsumer.GroupName)).PendingMessageCount);
    }

    [Fact]
    public async Task Entries_that_are_not_group_events_are_dropped_without_blocking_the_stream()
    {
        var stream = NewStream();
        var leader = Guid.NewGuid();
        await fixture.Redis.StreamAddAsync(stream, [new NameValueEntry("hello", "world")]);
        await fixture.Redis.StreamAddAsync(stream, [new NameValueEntry("eventId", Guid.NewGuid().ToString()), new NameValueEntry("type", "RoomLeaderChanged"), new NameValueEntry("payload", "{not json")]);
        await fixture.AppendAsync(stream, Guid.NewGuid(), "RoomLeaderChanged", new { courseId = Guid.NewGuid(), roomId = Guid.NewGuid(), roomName = "Room 05", leaderId = leader });

        var handled = await fixture.Consumer(stream).CatchUpAsync(Ct);

        Assert.Equal(1, handled);
        Assert.Single((await NoticesAsync(leader))[leader]);
        Assert.Equal(0, (await fixture.Redis.StreamPendingAsync(stream, GroupEventsConsumer.GroupName)).PendingMessageCount);
    }

    private static string NewStream() => $"group-events-test-{Guid.NewGuid():N}";

    private async Task<Dictionary<Guid, List<string>>> NoticesAsync(params Guid[] users)
    {
        var rows = await fixture.QueryAsync(database => database.Notifications.AsNoTracking()
            .Where(item => users.Contains(item.UserId))
            .Select(item => new { item.UserId, item.Type })
            .ToListAsync(Ct));
        return users.ToDictionary(user => user, user => rows.Where(row => row.UserId == user).Select(row => row.Type).ToList());
    }

    private static async Task<JsonElement> NextNotificationAsync(HubTestClient hub, string type)
    {
        while (true)
        {
            var notification = await hub.NextAsync(RealtimeHub.NotificationReceived);
            if (notification.GetProperty("type").GetString() == type)
            {
                return notification;
            }
        }
    }
}
