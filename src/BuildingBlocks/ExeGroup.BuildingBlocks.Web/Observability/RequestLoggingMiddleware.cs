using System.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace ExeGroup.BuildingBlocks.Web.Observability;

public sealed class RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var started = Stopwatch.GetTimestamp();
        try
        {
            await next(context);
        }
        finally
        {
            var elapsed = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
            var status = context.Response.StatusCode;
            var level = context.Request.Path.StartsWithSegments("/health") ? LogLevel.Debug
                : status >= StatusCodes.Status500InternalServerError ? LogLevel.Error
                : status >= StatusCodes.Status400BadRequest ? LogLevel.Warning
                : LogLevel.Information;

            logger.Log(
                level,
                "HTTP {Method} {Path} responded {StatusCode} in {ElapsedMs:0.0} ms",
                context.Request.Method,
                context.Request.Path.Value,
                status,
                elapsed);
        }
    }
}
