using System.Net.Mime;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Web.Formatters;
using ExeGroup.BuildingBlocks.Web.Responses;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace ExeGroup.BuildingBlocks.Web.Errors;

public static class EnvelopeWriter
{
    private static readonly JsonSerializerOptions FallbackOptions = new(JsonSerializerDefaults.Web);

    public static Task WriteFailureAsync(HttpContext context, int statusCode, string message, string code, string detail) =>
        WriteFailureAsync(context, statusCode, message, [new ApiError(code, null, detail)]);

    public static async Task WriteFailureAsync(HttpContext context, int statusCode, string message, IReadOnlyList<ApiError> errors)
    {
        var response = context.Response;
        response.StatusCode = statusCode;
        var body = ApiResponse.Failure(message, errors, TraceIds.For(context));
        var options = context.RequestServices.GetService<IOptions<JsonOptions>>()?.Value.JsonSerializerOptions ?? FallbackOptions;

        if (PrefersXml(context.Request))
        {
            response.ContentType = $"{MediaTypeNames.Application.Xml}; charset=utf-8";
            var document = JsonSerializer.SerializeToElement(body, options);
            await response.WriteAsync(JsonToXmlConverter.Serialize(document, "utf-8"), context.RequestAborted);
            return;
        }

        await response.WriteAsJsonAsync(body, options, context.RequestAborted);
    }

    private static bool PrefersXml(HttpRequest request)
    {
        var accepted = request.GetTypedHeaders().Accept.Where(type => type.Quality is not 0).ToList();
        if (accepted.Any(type => type.MatchesAllTypes))
        {
            return false;
        }

        foreach (var type in accepted.OrderByDescending(type => type.Quality ?? 1))
        {
            var mediaType = type.MediaType.Value ?? string.Empty;
            if (mediaType.Equals(MediaTypeNames.Application.Xml, StringComparison.OrdinalIgnoreCase)
                || mediaType.Equals(MediaTypeNames.Text.Xml, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (mediaType.Equals(MediaTypeNames.Application.Json, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
        }

        return false;
    }
}
