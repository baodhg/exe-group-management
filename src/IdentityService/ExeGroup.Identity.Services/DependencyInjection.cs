using ExeGroup.BuildingBlocks.Data;
using ExeGroup.Identity.Repositories;
using ExeGroup.Identity.Services.Auth;
using ExeGroup.Identity.Services.Security;
using ExeGroup.Identity.Services.Seeding;
using ExeGroup.Identity.Services.Users;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.Identity.Services;

public static class DependencyInjection
{
    public static IServiceCollection AddIdentityServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddIdentityRepositories(configuration);
        services.AddSingleton<IPasswordHasher, Pbkdf2PasswordHasher>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddSingleton<IDatabaseMigrator, AdministratorSeed>();
        return services;
    }
}
