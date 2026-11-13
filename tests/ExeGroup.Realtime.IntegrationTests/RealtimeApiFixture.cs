using System.Net.Http.Headers;
using System.Security.Claims;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Security;
using ExeGroup.Realtime.API.Hubs;
using ExeGroup.Realtime.Repositories;
using ExeGroup.Realtime.Repositories.Data;
using ExeGroup.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;

namespace ExeGroup.Realtime.IntegrationTests;

public class RealtimeApiFixture : IAsyncLifetime
{
    public TestCourseAccess CourseAccess { get; } = new();
    public ServiceApiFactory<Program> Api { get; private set; } = null!;

    public string ConnectionString { get; private set; } = string.Empty;

    public async ValueTask InitializeAsync()
    {
        ConnectionString = (await SqlServerContainer.SharedAsync()).NewDatabaseConnectionString("chat");
        Api = new RealtimeFactory(ConnectionString, await SettingsAsync(), CourseAccess);
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

    public async Task<T> QueryAsync<T>(Func<ChatDbContext, Task<T>> query)
    {
        await using var scope = Api.Services.CreateAsyncScope();
        return await query(scope.ServiceProvider.GetRequiredService<ChatDbContext>());
    }

    public async ValueTask DisposeAsync()
    {
        await Api.DisposeAsync();
    }

    protected virtual Task<Dictionary<string, string?>> SettingsAsync() =>
        Task.FromResult(new Dictionary<string, string?>
        {
            ["Jobs:GroupEventsConsumer:Enabled"] = "false",
            ["Jobs:ProcessedEventsCleanup:Enabled"] = "false",
        });

    private sealed class RealtimeFactory(string connectionString, Dictionary<string, string?> settings, TestCourseAccess access)
        : ServiceApiFactory<Program>(DependencyInjection.ConnectionName, connectionString, settings)
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.ConfigureTestServices(services => services.AddSingleton<ICourseAccessVerifier>(access));
        }
    }
}

public sealed class TestCourseAccess : ICourseAccessVerifier
{
    private readonly System.Collections.Concurrent.ConcurrentDictionary<(Guid Course, Guid User), bool> _allowed = new();

    public void Allow(Guid course, Guid user) => _allowed[(course, user)] = true;

    public Task<bool> CanReadAsync(Guid courseId, string accessToken, CancellationToken cancellationToken) =>
        Task.FromResult(Guid.TryParse(new JsonWebToken(accessToken).Subject, out var userId) && _allowed.ContainsKey((courseId, userId)));
}
