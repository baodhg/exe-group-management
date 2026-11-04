using System.Reflection;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Web.Health;
using ExeGroup.BuildingBlocks.Web.Observability;
using ExeGroup.BuildingBlocks.Web.OpenApi;
using ExeGroup.BuildingBlocks.Web.Security;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace ExeGroup.BuildingBlocks.Web.Hosting;

public static class ServiceDefaults
{
    public static ForwardedHeadersOptions GatewayForwardedHeaders()
    {
        var options = new ForwardedHeadersOptions
        {
            ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost,
        };
        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
        return options;
    }

    public static WebApplicationBuilder AddServiceDefaults(
        this WebApplicationBuilder builder,
        string serviceName,
        params Assembly[] apiAssemblies)
    {
        builder.AddServiceLogging(serviceName);
        builder.Services.AddCorrelation();
        builder.Services.TryAddSingleton<IClock, SystemClock>();
        builder.Services.AddApiDefaults(apiAssemblies);
        builder.Services.AddServiceSwagger(serviceName);
        builder.Services.AddJwtAuthentication(builder.Configuration);
        builder.Services.TryAddSingleton<DatabaseReadiness>();
        builder.Services.AddHealthChecks().AddCheck<DatabaseReadinessCheck>("migrations", HealthStatus.Unhealthy, [HealthTags.Ready]);
        builder.Services.PostConfigure<HealthCheckServiceOptions>(options =>
        {
            foreach (var registration in options.Registrations.Where(registration => registration.Timeout == Timeout.InfiniteTimeSpan))
            {
                registration.Timeout = HealthTags.CheckTimeout;
            }
        });
        return builder;
    }

    public static WebApplication UseServiceDefaults(this WebApplication app)
    {
        app.UseForwardedHeaders(GatewayForwardedHeaders());
        app.UseCorrelationAndRequestLogging();
        app.UseApiDefaults();
        app.UseRouting();
        app.UseServiceSwagger();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapServiceHealthChecks();
        return app;
    }
}
