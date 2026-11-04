using ExeGroup.BuildingBlocks.Data;
using ExeGroup.Group.Repositories.Data;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.Group.Repositories;

public static class DependencyInjection
{
    public const string ConnectionName = "GroupDb";

    public static IServiceCollection AddGroupRepositories(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSqlServerDatabase<GroupDbContext>(configuration, ConnectionName);
        return services;
    }
}
