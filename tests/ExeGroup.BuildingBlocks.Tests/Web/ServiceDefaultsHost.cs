using Asp.Versioning;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Hosting;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Testing;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace ExeGroup.BuildingBlocks.Tests.Web;

public static class ServiceDefaultsHost
{
    public static async Task<WebApplication> StartAsync(
        IReadOnlyDictionary<string, string?>? configuration = null,
        bool readyCheckFails = false,
        bool readyCheckHangs = false)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.WebHost.UseTestServer();
        builder.Configuration.AddInMemoryCollection(configuration ?? TestTokens.Configuration);
        builder.AddServiceDefaults("probe-service", typeof(ServiceDefaultsHost).Assembly);
        if (readyCheckFails)
        {
            builder.Services.AddHealthChecks().AddCheck(
                "always-down",
                () => HealthCheckResult.Unhealthy("down for the test"),
                ["ready"]);
        }

        if (readyCheckHangs)
        {
            builder.Services.AddHealthChecks().AddAsyncCheck(
                "hangs-forever",
                async cancellationToken =>
                {
                    await Task.Delay(Timeout.Infinite, cancellationToken);
                    return HealthCheckResult.Healthy();
                },
                ["ready"]);
        }

        var app = builder.Build();
        app.UseServiceDefaults();
        app.MapControllers();
        await app.StartAsync();
        return app;
    }
}

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/secure-probe")]
public sealed class SecureProbeController(ICurrentUser currentUser) : ApiControllerBase
{
    [HttpGet("me")]
    public IActionResult GetMe() => Success(new { userId = currentUser.UserId, roles = currentUser.Roles }, "Caller loaded");

    [HttpGet("admin")]
    [Authorize(Roles = Roles.Administrator)]
    public IActionResult GetAdmin() => Success("ok", "Administrator area");

    [HttpGet("public")]
    [AllowAnonymous]
    public IActionResult GetPublic() => Success("ok", "Public area");
}
