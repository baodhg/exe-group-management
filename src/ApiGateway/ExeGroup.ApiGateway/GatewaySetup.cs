using System.Threading.RateLimiting;
using ExeGroup.BuildingBlocks.Web.Health;
using ExeGroup.BuildingBlocks.Web.Hosting;
using ExeGroup.BuildingBlocks.Web.Observability;
using ExeGroup.BuildingBlocks.Web.Security;

namespace ExeGroup.ApiGateway;

public static class GatewaySetup
{
    public const string AuthRateLimitPolicy = "auth";

    public static readonly (string Name, string Title)[] ServiceDocuments =
    [
        ("identity", "Identity Service"),
        ("group", "Group Service"),
        ("realtime", "Realtime Service"),
    ];

    public static WebApplicationBuilder AddGateway(this WebApplicationBuilder builder)
    {
        builder.AddServiceLogging("api-gateway");
        builder.Services.AddCorrelation();
        builder.Services.AddJwtAuthentication(builder.Configuration);
        builder.Services.AddHealthChecks();
        builder.Services.AddReverseProxy().LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));
        builder.Services.AddSingleton<ClientAddressResolver>();

        var permits = builder.Configuration.GetValue("Gateway:AuthRateLimit:PermitLimit", 10);
        var window = TimeSpan.FromSeconds(builder.Configuration.GetValue("Gateway:AuthRateLimit:WindowSeconds", 60));
        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy(AuthRateLimitPolicy, context => RateLimitPartition.GetFixedWindowLimiter(
                context.RequestServices.GetRequiredService<ClientAddressResolver>().Resolve(context),
                _ => new FixedWindowRateLimiterOptions { PermitLimit = permits, Window = window, QueueLimit = 0 }));
        });

        return builder;
    }

    public static WebApplication UseGateway(this WebApplication app)
    {
        app.UseCorrelationAndRequestLogging();
        app.UseApiDefaults();
        app.UseSwaggerUI(options =>
        {
            options.RoutePrefix = "swagger";
            options.DocumentTitle = "EXE Group Management API";
            foreach (var (name, title) in ServiceDocuments)
            {
                options.SwaggerEndpoint($"/swagger/{name}/v1/swagger.json", title);
            }
        });
        app.UseRouting();
        app.UseRateLimiter();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapServiceHealthChecks();
        app.MapReverseProxy();
        return app;
    }
}
