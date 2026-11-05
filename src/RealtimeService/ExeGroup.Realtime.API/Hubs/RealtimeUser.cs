using System.Security.Claims;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.Realtime.Services.Conversations;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.SignalR;
using Microsoft.IdentityModel.JsonWebTokens;

namespace ExeGroup.Realtime.API.Hubs;

public static class RealtimeUser
{
    public const string AccessTokenQuery = "access_token";

    public static Guid IdOf(ClaimsPrincipal? user) =>
        Guid.TryParse(user?.FindFirstValue(JwtRegisteredClaimNames.Sub), out var id) ? id : throw new UnauthorizedException();

    public static Sender SenderOf(ClaimsPrincipal? user) =>
        new(
            IdOf(user),
            user?.FindFirstValue(JwtRegisteredClaimNames.Name) ?? user?.FindFirstValue(JwtRegisteredClaimNames.Email) ?? string.Empty);

    public static IServiceCollection AddRealtimeHub(this IServiceCollection services)
    {
        services.AddSignalR();
        services.AddSingleton<ConnectionRegistry>();
        services.AddSingleton<IUserIdProvider, SubjectUserIdProvider>();
        services.AddSingleton<Services.Push.IRealtimePush, HubPush>();
        services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
        {
            options.Events ??= new JwtBearerEvents();
            var previous = options.Events.OnMessageReceived;
            options.Events.OnMessageReceived = async context =>
            {
                await previous(context);
                if (string.IsNullOrEmpty(context.Token)
                    && context.HttpContext.Request.Path.StartsWithSegments(RealtimeHub.Route)
                    && context.Request.Query[AccessTokenQuery].ToString() is { Length: > 0 } token)
                {
                    context.Token = token;
                }
            };
        });
        return services;
    }

    private sealed class SubjectUserIdProvider : IUserIdProvider
    {
        public string? GetUserId(HubConnectionContext connection) => connection.User?.FindFirstValue(JwtRegisteredClaimNames.Sub);
    }
}
