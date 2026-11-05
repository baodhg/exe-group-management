using System.Net;
using System.Text.Json;

namespace ExeGroup.ApiGateway.Tests;

public sealed class GatewayRateLimitTests : IAsyncLifetime
{
    private readonly GatewayFixture _gateway = new() { Permits = GatewayFixture.AuthPermits };

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public ValueTask InitializeAsync() => _gateway.InitializeAsync();

    public ValueTask DisposeAsync() => _gateway.DisposeAsync();

    [Fact]
    public async Task Sign_in_attempts_beyond_the_limit_get_a_429_envelope()
    {
        var client = _gateway.CreateClient();
        for (var attempt = 0; attempt < GatewayFixture.AuthPermits; attempt++)
        {
            var allowed = await client.PostAsync("/api/v1/auth/login", null, Ct);
            Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
        }

        var blocked = await client.PostAsync("/api/v1/auth/login", null, Ct);
        var body = JsonDocument.Parse(await blocked.Content.ReadAsStringAsync(Ct)).RootElement;

        Assert.Equal(HttpStatusCode.TooManyRequests, blocked.StatusCode);
        Assert.Equal("TOO_MANY_REQUESTS", body.GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Fact]
    public async Task Browsers_behind_the_web_proxy_are_limited_separately()
    {
        var client = _gateway.CreateClient();
        await ExhaustLimitAsync(client, "127.0.0.1", "203.0.113.1");

        var sameBrowser = await SignInAsync(client, "127.0.0.1", "203.0.113.1");
        var otherBrowser = await SignInAsync(client, "127.0.0.1", "203.0.113.2");

        Assert.Equal(HttpStatusCode.TooManyRequests, sameBrowser.StatusCode);
        Assert.Equal(HttpStatusCode.OK, otherBrowser.StatusCode);
    }

    [Fact]
    public async Task Only_the_address_added_by_the_web_proxy_counts_when_a_client_prefills_the_header()
    {
        var client = _gateway.CreateClient();
        await ExhaustLimitAsync(client, "127.0.0.1", "198.51.100.1, 203.0.113.1");

        var spoofed = await SignInAsync(client, "127.0.0.1", "198.51.100.2, 203.0.113.1");

        Assert.Equal(HttpStatusCode.TooManyRequests, spoofed.StatusCode);
    }

    [Fact]
    public async Task A_client_calling_the_gateway_directly_cannot_escape_the_limit_with_a_forged_header()
    {
        var client = _gateway.CreateClient();
        await ExhaustLimitAsync(client, "192.0.2.10", "203.0.113.1");

        var forged = await SignInAsync(client, "192.0.2.10", "203.0.113.99");

        Assert.Equal(HttpStatusCode.TooManyRequests, forged.StatusCode);
    }

    private static async Task ExhaustLimitAsync(HttpClient client, string peer, string forwardedFor)
    {
        for (var attempt = 0; attempt < GatewayFixture.AuthPermits; attempt++)
        {
            Assert.Equal(HttpStatusCode.OK, (await SignInAsync(client, peer, forwardedFor)).StatusCode);
        }
    }

    private static async Task<HttpResponseMessage> SignInAsync(HttpClient client, string peer, string forwardedFor)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/login");
        request.Headers.Add(GatewayFixture.TestPeerHeader, peer);
        request.Headers.Add("X-Forwarded-For", forwardedFor);
        return await client.SendAsync(request, Ct);
    }
}
