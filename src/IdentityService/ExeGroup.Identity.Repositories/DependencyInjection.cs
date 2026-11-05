using ExeGroup.BuildingBlocks.Data;
using ExeGroup.Identity.Repositories.Data;
using ExeGroup.Identity.Repositories.Interfaces;
using ExeGroup.Identity.Repositories.Repositories;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.Identity.Repositories;

public static class DependencyInjection
{
    public const string ConnectionName = "IdentityDb";

    public static IServiceCollection AddIdentityRepositories(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSqlServerDatabase<IdentityDbContext>(configuration, ConnectionName);
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        return services;
    }
}
