using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Testing;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.ApiGateway.Tests;

public sealed class GatewayFixture : IAsyncLifetime
{
    public const int AuthPermits = 3;

    private WebApplication _downstream = null!;
    private WebApplicationFactory<Program> _gateway = null!;

    public HttpClient CreateClient() => _gateway.CreateClient();

    public async ValueTask InitializeAsync()
    {
        _downstream = await StartEchoServiceAsync();
        var echo = _downstream.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.First();

        _gateway = new WebApplicationFactory<Program>().WithWebHostBuilder(host =>
        {
            host.UseEnvironment("Testing");
            foreach (var (key, value) in TestTokens.Configuration)
            {
                host.UseSetting(key, value);
            }

            host.UseSetting("Gateway:AuthRateLimit:PermitLimit", AuthPermits.ToString());
            host.UseSetting("ReverseProxy:Clusters:identity:Destinations:primary:Address", echo);
            host.UseSetting("ReverseProxy:Clusters:group:Destinations:primary:Address", echo);
            host.UseSetting("ReverseProxy:Clusters:join-request:Destinations:primary:Address", "http://127.0.0.1:9");
        });
    }

    public async ValueTask DisposeAsync()
    {
        await _gateway.DisposeAsync();
        await _downstream.DisposeAsync();
    }

    private static async Task<WebApplication> StartEchoServiceAsync()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        var app = builder.Build();
        app.Map("{**path}", (HttpContext context) => Results.Json(new
        {
            method = context.Request.Method,
            path = context.Request.Path.Value,
            authorization = context.Request.Headers.Authorization.ToString(),
            correlation = context.Request.Headers[CorrelationContext.HeaderName].ToString(),
        }));
        await app.StartAsync();
        return app;
    }
}
