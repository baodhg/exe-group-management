using ExeGroup.BuildingBlocks.Data;
using ExeGroup.JoinRequest.Repositories.External;
using ExeGroup.JoinRequest.Repositories.Data;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.JoinRequest.Repositories;

public static class DependencyInjection
{
    public const string ConnectionName = "RequestDb";

    public static IServiceCollection AddJoinRequestRepositories(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSqlServerDatabase<JoinRequestDbContext>(configuration, ConnectionName);
        services.AddGroupMembershipClient(configuration);
        return services;
    }
}
