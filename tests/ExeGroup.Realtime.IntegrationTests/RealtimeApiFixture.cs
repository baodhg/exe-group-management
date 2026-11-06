using System.Net.Http.Headers;
using System.Security.Claims;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Security;
using ExeGroup.Realtime.Repositories;
using ExeGroup.Realtime.Repositories.Data;
using ExeGroup.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;

namespace ExeGroup.Realtime.IntegrationTests;

public sealed class RealtimeApiFixture : IAsyncLifetime
{
    public ServiceApiFactory<Program> Api { get; private set; } = null!;

    public string ConnectionString { get; private set; } = string.Empty;

    public async ValueTask InitializeAsync()
    {
        ConnectionString = (await SqlServerContainer.SharedAsync()).NewDatabaseConnectionString("chat");
        Api = new ServiceApiFactory<Program>(DependencyInjection.ConnectionName, ConnectionString);
        await Api.MigrateAsync();
    }

    public static string TokenFor(Guid userId, string? name = null)
    {
        Claim[] claims = name is null ? [] : [new Claim(JwtRegisteredClaimNames.Name, name)];
        return new AccessTokenFactory(TestTokens.Options).Create(userId, [Roles.Student], claims).Token;
    }

    public HttpClient ClientFor(Guid userId, string? name = null)
    {
        var client = Api.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", TokenFor(userId, name));
        return client;
    }

    public Task<HubTestClient> HubFor(Guid? userId, string? name = null) =>
        HubTestClient.ConnectAsync(Api.Server, userId is { } id ? TokenFor(id, name) : null, TestContext.Current.CancellationToken);

    public async Task SeedAsync(Action<ChatDbContext> seed, CancellationToken cancellationToken)
    {
        await using var scope = Api.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<ChatDbContext>();
        seed(database);
        await database.SaveChangesAsync(cancellationToken);
    }

    public async ValueTask DisposeAsync()
    {
        await Api.DisposeAsync();
    }
}
