using ExeGroup.Realtime.Repositories;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.Realtime.Services;

public static class DependencyInjection
{
    public static IServiceCollection AddRealtimeServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddRealtimeRepositories(configuration);
        return services;
    }
}
