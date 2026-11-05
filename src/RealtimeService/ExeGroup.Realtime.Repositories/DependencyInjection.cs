using ExeGroup.BuildingBlocks.Data;
using ExeGroup.Realtime.Repositories.Data;
using ExeGroup.Realtime.Repositories.Interfaces;
using ExeGroup.Realtime.Repositories.Repositories;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.Realtime.Repositories;

public static class DependencyInjection
{
    public const string ConnectionName = "ChatDb";

    public static IServiceCollection AddRealtimeRepositories(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSqlServerDatabase<ChatDbContext>(configuration, ConnectionName);
        services.AddScoped<IConversationRepository, ConversationRepository>();
        services.AddScoped<IMessageRepository, MessageRepository>();
        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<IGroupEventRepository, GroupEventRepository>();
        return services;
    }
}
