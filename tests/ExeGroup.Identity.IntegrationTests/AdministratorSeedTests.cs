using System.Net;
using System.Net.Http.Json;
using ExeGroup.Identity.Repositories;
using ExeGroup.Identity.Repositories.Data;
using ExeGroup.Identity.Services.Seeding;
using ExeGroup.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.Identity.IntegrationTests;

public sealed class AdministratorSeedTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task The_configured_administrator_is_created_once_and_can_sign_in()
    {
        var password = IdentityApi.NewPassword();
        var connectionString = (await SqlServerContainer.SharedAsync()).NewDatabaseConnectionString("seed");
        await using var api = new ServiceApiFactory<Program>(
            DependencyInjection.ConnectionName,
            connectionString,
            new Dictionary<string, string?>
            {
                [AdministratorSeed.EmailKey] = "Admin@FPT.edu.vn",
                [AdministratorSeed.PasswordKey] = password,
            });

        await api.MigrateAsync(Ct);
        await api.MigrateAsync(Ct);
        var login = await api.AnonymousClient().PostAsJsonAsync("/api/v1/auth/login", new { email = "admin@fpt.edu.vn", password }, Ct);
        await using var scope = api.Services.CreateAsyncScope();
        var count = await scope.ServiceProvider.GetRequiredService<IdentityDbContext>().Users.CountAsync(user => user.Email == "admin@fpt.edu.vn", Ct);

        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.Equal(1, count);
    }
}
