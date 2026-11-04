using System.Reflection;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Health;
using ExeGroup.BuildingBlocks.Web.Observability;
using ExeGroup.BuildingBlocks.Web.OpenApi;
using ExeGroup.BuildingBlocks.Web.Security;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ExeGroup.BuildingBlocks.Web.Hosting;

public static class ServiceDefaults
{
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
        builder.Services.AddHealthChecks();
        return builder;
    }

    public static WebApplication UseServiceDefaults(this WebApplication app)
    {
        app.UseCorrelationAndRequestLogging();
        app.UseApiDefaults();
        app.UseServiceSwagger();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapServiceHealthChecks();
        return app;
    }
}
