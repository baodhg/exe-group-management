using ExeGroup.BuildingBlocks.Data;
using ExeGroup.Identity.Repositories.Entities;
using ExeGroup.Identity.Repositories.Interfaces;
using ExeGroup.Identity.Services.Security;
using ExeGroup.Identity.Services.Users;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.Identity.Services.Seeding;

public sealed class AdministratorSeed(IServiceScopeFactory scopes, IConfiguration configuration, IPasswordHasher hasher) : IDatabaseMigrator
{
    public const string EmailKey = "SEED_ADMIN_EMAIL";
    public const string PasswordKey = "SEED_ADMIN_PASSWORD";

    public string Name => nameof(AdministratorSeed);

    public async Task MigrateAsync(CancellationToken cancellationToken)
    {
        var email = configuration[EmailKey];
        var password = configuration[PasswordKey];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrEmpty(password))
        {
            return;
        }

        await using var scope = scopes.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<IUserRepository>();
        var normalized = UserService.NormalizeEmail(email);
        if (await users.EmailExistsAsync(normalized, cancellationToken))
        {
            return;
        }

        var administrator = new User
        {
            UserId = Guid.NewGuid(),
            Email = normalized,
            FullName = "Administrator",
            PasswordHash = hasher.Hash(password),
        };
        administrator.UserRoles.Add(new UserRole { RoleId = Role.AdministratorId });
        users.Add(administrator);
        await users.TrySaveChangesAsync(cancellationToken);
    }
}
