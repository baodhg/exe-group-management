using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Testing;

namespace ExeGroup.ApiGateway.Tests;

public sealed class GatewayRoutingTests(GatewayFixture gateway) : IClassFixture<GatewayFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Theory]
    [InlineData("/api/v1/semesters")]
    [InlineData("/api/v1/rooms/42")]
    [InlineData("/api/v1/join-requests")]
    [InlineData("/api/v1/users")]
    [InlineData("/api/v1/auth/me")]
    public async Task Protected_routes_are_rejected_at_the_edge_without_a_token(string path)
    {
        var (status, body) = await SendAsync(HttpMethod.Get, path);

        Assert.Equal(HttpStatusCode.Unauthorized, status);
        Assert.Equal("UNAUTHORIZED", body.GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Theory]
    [InlineData("/api/v1/auth/login")]
    [InlineData("/api/v1/auth/refresh-token")]
    [InlineData("/api/v1/auth/logout")]
    public async Task Sign_in_routes_pass_through_without_a_token(string path)
    {
        var (status, body) = await SendAsync(HttpMethod.Post, path);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(path, body.GetProperty("path").GetString());
    }

    [Theory]
    [InlineData("/api/v1/semesters?page=2")]
    [InlineData("/api/v1/courses/7/overview")]
    [InlineData("/api/v1/users/3")]
    public async Task Authorized_calls_are_forwarded_with_token_and_correlation_id(string path)
    {
        var token = TestTokens.For(Guid.NewGuid(), Roles.Administrator);

        var (status, body, response) = await SendWithResponseAsync(HttpMethod.Get, path, token);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(path.Split('?')[0], body.GetProperty("path").GetString());
        Assert.Equal($"Bearer {token}", body.GetProperty("authorization").GetString());
        var issued = Assert.Single(response.Headers.GetValues(CorrelationContext.HeaderName));
        Assert.Equal(issued, body.GetProperty("correlation").GetString());
    }

    [Fact]
    public async Task A_valid_incoming_correlation_id_reaches_the_service_unchanged()
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/login");
        request.Headers.Add(CorrelationContext.HeaderName, "demo-step-5");

        var response = await gateway.CreateClient().SendAsync(request, Ct);
        var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement;

        Assert.Equal("demo-step-5", body.GetProperty("correlation").GetString());
    }

    [Theory]
    [InlineData("/swagger/identity/v1/swagger.json", "/swagger/v1/swagger.json")]
    [InlineData("/swagger/group/v1/swagger.json", "/swagger/v1/swagger.json")]
    public async Task Service_documents_are_proxied_without_the_service_prefix(string path, string forwardedPath)
    {
        var (status, body) = await SendAsync(HttpMethod.Get, path);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(forwardedPath, body.GetProperty("path").GetString());
    }

    [Fact]
    public async Task Swagger_ui_lists_the_three_services()
    {
        var html = await gateway.CreateClient().GetStringAsync("/swagger/index.html", Ct);
        var config = await gateway.CreateClient().GetStringAsync("/swagger/index.js", Ct);

        Assert.Contains("swagger-ui", html);
        Assert.Contains("/swagger/identity/v1/swagger.json", config);
        Assert.Contains("/swagger/group/v1/swagger.json", config);
        Assert.Contains("/swagger/realtime/v1/swagger.json", config);
    }

    [Fact]
    public async Task An_unreachable_service_returns_a_502_envelope()
    {
        var token = TestTokens.For(Guid.NewGuid(), Roles.Student);

        var (status, body) = await SendAsync(HttpMethod.Get, "/api/v1/notifications", token);

        Assert.Equal(HttpStatusCode.BadGateway, status);
        Assert.Equal("UPSTREAM_UNAVAILABLE", body.GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Fact]
    public async Task Unknown_paths_are_404_envelopes()
    {
        var (status, body) = await SendAsync(HttpMethod.Get, "/api/v1/nothing-here", TestTokens.For(Guid.NewGuid(), Roles.Student));

        Assert.Equal(HttpStatusCode.NotFound, status);
        Assert.False(body.GetProperty("success").GetBoolean());
    }

    [Fact]
    public async Task Liveness_is_open()
    {
        var response = await gateway.CreateClient().GetAsync("/health/live", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private async Task<(HttpStatusCode Status, JsonElement Body)> SendAsync(HttpMethod method, string path, string? token = null)
    {
        var (status, body, _) = await SendWithResponseAsync(method, path, token);
        return (status, body);
    }

    private async Task<(HttpStatusCode Status, JsonElement Body, HttpResponseMessage Response)> SendWithResponseAsync(
        HttpMethod method,
        string path,
        string? token)
    {
        using var request = new HttpRequestMessage(method, path);
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        var response = await gateway.CreateClient().SendAsync(request, Ct);
        var text = await response.Content.ReadAsStringAsync(Ct);
        return (response.StatusCode, JsonDocument.Parse(text).RootElement, response);
    }
}
