using ExeGroup.Group.Repositories;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.Group.Services;

public static class DependencyInjection
{
    public static IServiceCollection AddGroupServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddGroupRepositories(configuration);
        return services;
    }
}
