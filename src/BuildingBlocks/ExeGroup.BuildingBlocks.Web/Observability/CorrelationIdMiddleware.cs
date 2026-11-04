using System.Text.RegularExpressions;
using ExeGroup.BuildingBlocks.Context;
using Microsoft.AspNetCore.Http;
using Serilog.Context;

namespace ExeGroup.BuildingBlocks.Web.Observability;

public sealed partial class CorrelationIdMiddleware(RequestDelegate next, ICorrelationContext correlation)
{
    public const string LogProperty = "CorrelationId";

    public async Task InvokeAsync(HttpContext context)
    {
        var incoming = context.Request.Headers[CorrelationContext.HeaderName].ToString();
        var id = SafeId().IsMatch(incoming) ? incoming : CorrelationContext.NewId();

        context.Request.Headers[CorrelationContext.HeaderName] = id;
        context.TraceIdentifier = id;
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[CorrelationContext.HeaderName] = id;
            return Task.CompletedTask;
        });

        using (correlation.Begin(id))
        using (LogContext.PushProperty(LogProperty, id))
        {
            await next(context);
        }
    }

    [GeneratedRegex("^[A-Za-z0-9._:-]{1,64}$")]
    private static partial Regex SafeId();
}
