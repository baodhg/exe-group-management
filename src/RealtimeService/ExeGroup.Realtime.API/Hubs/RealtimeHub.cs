using Microsoft.AspNetCore.SignalR;

namespace ExeGroup.Realtime.API.Hubs;

public sealed class RealtimeHub : Hub
{
    public const string Route = "/hubs/realtime";
}
