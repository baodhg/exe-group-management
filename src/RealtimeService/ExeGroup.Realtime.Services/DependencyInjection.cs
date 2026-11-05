using ExeGroup.Realtime.Repositories;
using ExeGroup.Realtime.Services.Conversations;
using ExeGroup.Realtime.Services.Notifications;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.Realtime.Services;

public static class DependencyInjection
{
    public static IServiceCollection AddRealtimeServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddRealtimeRepositories(configuration);
        services.AddScoped<IConversationService, ConversationService>();
        services.AddScoped<INotificationService, NotificationService>();
        return services;
    }
}
