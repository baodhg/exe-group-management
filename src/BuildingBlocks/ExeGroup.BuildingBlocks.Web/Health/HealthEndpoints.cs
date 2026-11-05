using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.BuildingBlocks.Web.Responses;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace ExeGroup.BuildingBlocks.Web.Health;

public static class HealthEndpoints
{
    public const string LivePath = "/health/live";
    public const string ReadyPath = "/health/ready";

    public static IEndpointRouteBuilder MapServiceHealthChecks(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapHealthChecks(LivePath, new HealthCheckOptions { Predicate = _ => false, ResponseWriter = WriteAsync })
            .AllowAnonymous();
        endpoints.MapHealthChecks(ReadyPath, new HealthCheckOptions
        {
            Predicate = check => check.Tags.Contains(HealthTags.Ready),
            ResponseWriter = WriteAsync,
        }).AllowAnonymous();
        return endpoints;
    }

    private static Task WriteAsync(HttpContext context, HealthReport report)
    {
        var healthy = report.Status != HealthStatus.Unhealthy;
        var data = new
        {
            status = report.Status.ToString(),
            totalDurationMs = Math.Round(report.TotalDuration.TotalMilliseconds, 1),
            checks = report.Entries.Select(entry => new
            {
                name = entry.Key,
                status = entry.Value.Status.ToString(),
                durationMs = Math.Round(entry.Value.Duration.TotalMilliseconds, 1),
                description = entry.Value.Description,
            }),
        };

        var body = new ApiResponse<object>
        {
            Success = healthy,
            Message = healthy ? "Service is healthy" : "Service is not ready",
            Data = data,
            Errors = healthy ? null : [new ApiError(ErrorCodes.UpstreamUnavailable, null, "A dependency of this service is not ready.")],
            TraceId = TraceIds.For(context),
        };
        return context.Response.WriteAsJsonAsync(body, context.RequestAborted);
    }
}
