using ExeGroup.JoinRequest.Repositories;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.JoinRequest.Services;

public static class DependencyInjection
{
    public static IServiceCollection AddJoinRequestServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddJoinRequestRepositories(configuration);
        return services;
    }
}
