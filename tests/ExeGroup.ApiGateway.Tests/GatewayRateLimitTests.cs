using System.Net;
using System.Text.Json;

namespace ExeGroup.ApiGateway.Tests;

public sealed class GatewayRateLimitTests : IAsyncLifetime
{
    private readonly GatewayFixture _gateway = new();

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
}
