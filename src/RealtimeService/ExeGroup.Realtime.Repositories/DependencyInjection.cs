using ExeGroup.BuildingBlocks.Data;
using ExeGroup.Realtime.Repositories.Data;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.Realtime.Repositories;

public static class DependencyInjection
{
    public const string ConnectionName = "ChatDb";

    public static IServiceCollection AddRealtimeRepositories(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSqlServerDatabase<ChatDbContext>(configuration, ConnectionName);
        return services;
    }
}
