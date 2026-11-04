using ExeGroup.BuildingBlocks.Context;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Serilog;
using Serilog.Events;

namespace ExeGroup.BuildingBlocks.Web.Observability;

public static class ObservabilityExtensions
{
    public const string ConsoleTemplate =
        "[{Timestamp:HH:mm:ss} {Level:u3}] {Service} {CorrelationId} {SourceContext}: {Message:lj}{NewLine}{Exception}";

    public static IServiceCollection AddCorrelation(this IServiceCollection services)
    {
        services.TryAddSingleton<ICorrelationContext, CorrelationContext>();
        return services;
    }

    public static WebApplicationBuilder AddServiceLogging(this WebApplicationBuilder builder, string serviceName)
    {
        builder.Services.AddSerilog((services, configuration) => configuration
            .ReadFrom.Configuration(builder.Configuration)
            .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
            .MinimumLevel.Override("Microsoft.EntityFrameworkCore.Database.Command", LogEventLevel.Warning)
            .MinimumLevel.Override("Yarp", LogEventLevel.Warning)
            .Enrich.FromLogContext()
            .Enrich.WithProperty("Service", serviceName)
            .WriteTo.Console(outputTemplate: ConsoleTemplate));
        return builder;
    }

    public static WebApplication UseCorrelationAndRequestLogging(this WebApplication app)
    {
        app.UseMiddleware<CorrelationIdMiddleware>();
        app.UseMiddleware<RequestLoggingMiddleware>();
        return app;
    }
}
