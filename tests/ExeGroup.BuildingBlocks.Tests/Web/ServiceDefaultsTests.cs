using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Options;

namespace ExeGroup.BuildingBlocks.Tests.Web;

public sealed class ServiceDefaultsTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task A_signing_key_shorter_than_32_bytes_stops_the_service_at_startup()
    {
        var configuration = new Dictionary<string, string?>(TestTokens.Configuration) { ["Jwt:SigningKey"] = "too-short" };

        var error = await Assert.ThrowsAsync<OptionsValidationException>(() => ServiceDefaultsHost.StartAsync(configuration));

        Assert.Contains("SigningKey", error.Message);
    }

    [Fact]
    public async Task Endpoints_require_a_token_by_default()
    {
        await using var app = await ServiceDefaultsHost.StartAsync();

        var (status, body) = await GetAsync(app.GetTestClient(), "/api/v1/secure-probe/me");

        Assert.Equal(HttpStatusCode.Unauthorized, status);
        Assert.Equal("UNAUTHORIZED", body.GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Fact]
    public async Task Anonymous_endpoints_stay_open()
    {
        await using var app = await ServiceDefaultsHost.StartAsync();

        var (status, _) = await GetAsync(app.GetTestClient(), "/api/v1/secure-probe/public");

        Assert.Equal(HttpStatusCode.OK, status);
    }

    [Fact]
    public async Task An_expired_token_is_rejected()
    {
        await using var app = await ServiceDefaultsHost.StartAsync();

        var (status, body) = await GetAsync(app.GetTestClient(), "/api/v1/secure-probe/me", TestTokens.Expired(Guid.NewGuid(), Roles.Student));

        Assert.Equal(HttpStatusCode.Unauthorized, status);
        Assert.Equal("UNAUTHORIZED", body.GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Fact]
    public async Task A_token_signed_with_another_key_is_rejected()
    {
        await using var app = await ServiceDefaultsHost.StartAsync();
        var forged = new ExeGroup.BuildingBlocks.Web.Security.AccessTokenFactory(new()
        {
            Issuer = TestTokens.Issuer,
            Audience = TestTokens.Audience,
            SigningKey = "another-signing-key-that-is-long-enough-1234",
        }).Create(Guid.NewGuid(), [Roles.Administrator]).Token;

        var (status, body) = await GetAsync(app.GetTestClient(), "/api/v1/secure-probe/admin", forged);

        Assert.Equal(HttpStatusCode.Unauthorized, status);
        Assert.Equal("UNAUTHORIZED", body.GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Theory]
    [InlineData("someone-else", TestTokens.Audience)]
    [InlineData(TestTokens.Issuer, "another-audience")]
    public async Task Tokens_for_another_issuer_or_audience_are_rejected(string issuer, string audience)
    {
        await using var app = await ServiceDefaultsHost.StartAsync();
        var token = new ExeGroup.BuildingBlocks.Web.Security.AccessTokenFactory(new()
        {
            Issuer = issuer,
            Audience = audience,
            SigningKey = TestTokens.SigningKey,
        }).Create(Guid.NewGuid(), [Roles.Administrator]).Token;

        var (status, _) = await GetAsync(app.GetTestClient(), "/api/v1/secure-probe/admin", token);

        Assert.Equal(HttpStatusCode.Unauthorized, status);
    }

    [Fact]
    public async Task A_valid_token_exposes_the_caller_id_and_roles()
    {
        await using var app = await ServiceDefaultsHost.StartAsync();
        var userId = Guid.NewGuid();

        var (status, body) = await GetAsync(app.GetTestClient(), "/api/v1/secure-probe/me", TestTokens.For(userId, Roles.Lecturer));

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(userId, body.GetProperty("data").GetProperty("userId").GetGuid());
        Assert.Equal(Roles.Lecturer, body.GetProperty("data").GetProperty("roles")[0].GetString());
    }

    [Fact]
    public async Task A_role_mismatch_is_forbidden_with_an_envelope()
    {
        await using var app = await ServiceDefaultsHost.StartAsync();

        var (status, body) = await GetAsync(app.GetTestClient(), "/api/v1/secure-probe/admin", TestTokens.For(Guid.NewGuid(), Roles.Student));

        Assert.Equal(HttpStatusCode.Forbidden, status);
        Assert.Equal("FORBIDDEN", body.GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Fact]
    public async Task The_right_role_gets_in()
    {
        await using var app = await ServiceDefaultsHost.StartAsync();

        var (status, _) = await GetAsync(app.GetTestClient(), "/api/v1/secure-probe/admin", TestTokens.For(Guid.NewGuid(), Roles.Administrator));

        Assert.Equal(HttpStatusCode.OK, status);
    }

    [Fact]
    public async Task An_unknown_api_version_is_an_envelope_error()
    {
        await using var app = await ServiceDefaultsHost.StartAsync();

        var token = TestTokens.For(Guid.NewGuid(), Roles.Administrator);

        var (status, body) = await GetAsync(app.GetTestClient(), "/api/v9/secure-probe/me", token);

        Assert.True(status is HttpStatusCode.BadRequest or HttpStatusCode.NotFound, $"unexpected {status}");
        Assert.False(body.GetProperty("success").GetBoolean());
        Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("errors")[0].GetProperty("code").GetString()));
    }

    [Fact]
    public async Task Liveness_and_readiness_are_open_and_readiness_reflects_dependencies()
    {
        await using var healthy = await ServiceDefaultsHost.StartAsync();
        await using var broken = await ServiceDefaultsHost.StartAsync(readyCheckFails: true);

        Assert.Equal(HttpStatusCode.OK, (await healthy.GetTestClient().GetAsync("/health/live", Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await healthy.GetTestClient().GetAsync("/health/ready", Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await broken.GetTestClient().GetAsync("/health/live", Ct)).StatusCode);

        var (status, body) = await GetAsync(broken.GetTestClient(), "/health/ready");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, status);
        Assert.Equal("Unhealthy", body.GetProperty("data").GetProperty("status").GetString());
    }

    [Fact]
    public async Task A_hanging_dependency_check_times_out_instead_of_blocking_readiness()
    {
        await using var app = await ServiceDefaultsHost.StartAsync(readyCheckHangs: true);
        var started = System.Diagnostics.Stopwatch.StartNew();

        var (status, _) = await GetAsync(app.GetTestClient(), "/health/ready");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, status);
        Assert.True(started.Elapsed < TimeSpan.FromSeconds(10), $"readiness took {started.Elapsed}");
    }

    [Fact]
    public async Task Readiness_stays_red_until_migrations_have_run()
    {
        var builder = Microsoft.AspNetCore.Builder.WebApplication.CreateBuilder(new Microsoft.AspNetCore.Builder.WebApplicationOptions { EnvironmentName = "Testing" });
        Microsoft.AspNetCore.Hosting.HostingAbstractionsWebHostBuilderExtensions.UseEnvironment(builder.WebHost, "Testing");
        builder.WebHost.UseTestServer();
        Microsoft.Extensions.Configuration.MemoryConfigurationBuilderExtensions.AddInMemoryCollection(builder.Configuration, TestTokens.Configuration);
        ExeGroup.BuildingBlocks.Web.Hosting.ServiceDefaults.AddServiceDefaults(builder, "probe-service", typeof(ServiceDefaultsHost).Assembly);
        await using var app = builder.Build();
        ExeGroup.BuildingBlocks.Web.Hosting.ServiceDefaults.UseServiceDefaults(app);
        await app.StartAsync(Ct);

        var before = (await app.GetTestClient().GetAsync("/health/ready", Ct)).StatusCode;
        await ExeGroup.BuildingBlocks.Web.Hosting.DatabaseStartup.MigrateDatabasesAsync(app);
        var after = (await app.GetTestClient().GetAsync("/health/ready", Ct)).StatusCode;

        Assert.Equal(HttpStatusCode.ServiceUnavailable, before);
        Assert.Equal(HttpStatusCode.OK, after);
    }

    [Fact]
    public async Task Swagger_publishes_one_document_per_version_with_a_bearer_scheme()
    {
        await using var app = await ServiceDefaultsHost.StartAsync();

        var response = await app.GetTestClient().GetAsync("/swagger/v1/swagger.json", Ct);
        var text = await response.Content.ReadAsStringAsync(Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("/api/v1/secure-probe/me", text);
        Assert.Contains("\"bearer\"", text, StringComparison.OrdinalIgnoreCase);
    }

    private static async Task<(HttpStatusCode Status, JsonElement Body)> GetAsync(HttpClient client, string path, string? token = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        var response = await client.SendAsync(request, Ct);
        var text = await response.Content.ReadAsStringAsync(Ct);
        return (response.StatusCode, JsonDocument.Parse(text).RootElement);
    }
}
