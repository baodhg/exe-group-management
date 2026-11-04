using ExeGroup.BuildingBlocks.Errors;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.WebUtilities;

namespace ExeGroup.BuildingBlocks.Web.Errors;

public static class StatusCodeEnvelope
{
    public static IApplicationBuilder UseEnvelopeStatusCodePages(this IApplicationBuilder app) =>
        app.UseStatusCodePages(context => WriteAsync(context.HttpContext));

    public static Task WriteAsync(HttpContext context)
    {
        var request = context.Request;
        var status = context.Response.StatusCode;
        var path = request.Path.ToUriComponent();

        var (message, code, detail) = status switch
        {
            StatusCodes.Status400BadRequest => ("Bad request", ErrorCodes.BadRequest, "The request could not be processed."),
            StatusCodes.Status401Unauthorized => ("Authentication required", ErrorCodes.Unauthorized, "A valid bearer access token is required."),
            StatusCodes.Status403Forbidden => ("Forbidden", ErrorCodes.Forbidden, "Your role does not allow access to this resource."),
            StatusCodes.Status404NotFound => ("Resource not found", ErrorCodes.NotFound, $"No endpoint matches {request.Method} {path}."),
            StatusCodes.Status405MethodNotAllowed => ("Method not allowed", ErrorCodes.MethodNotAllowed, $"{request.Method} is not supported on {path}."),
            StatusCodes.Status406NotAcceptable => ("Not acceptable", ErrorCodes.NotAcceptable, "Use Accept: application/json or application/xml."),
            StatusCodes.Status415UnsupportedMediaType => ("Unsupported media type", ErrorCodes.UnsupportedMediaType, "Send the request body as application/json."),
            StatusCodes.Status429TooManyRequests => ("Too many requests", ErrorCodes.TooManyRequests, "Slow down and retry later."),
            StatusCodes.Status502BadGateway or StatusCodes.Status503ServiceUnavailable or StatusCodes.Status504GatewayTimeout =>
                ("Upstream service unavailable", ErrorCodes.UpstreamUnavailable, "A downstream service did not answer. Retry later."),
            >= 500 => ("Internal server error", ErrorCodes.InternalError, "An unexpected error occurred."),
            _ => (ReasonPhrases.GetReasonPhrase(status), ErrorCodes.BadRequest, $"The request failed with status code {status}."),
        };

        return EnvelopeWriter.WriteFailureAsync(context, status, message, code, detail);
    }
}
