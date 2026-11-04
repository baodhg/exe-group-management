using System.Text.Json;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.BuildingBlocks.Web.Responses;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.BuildingBlocks.Web.Validation;

public static class ValidationResponseFactory
{
    private const string JsonRoot = "$";
    private const string JsonPropertyPrefix = "$.";

    public static IActionResult Create(ActionContext context)
    {
        var errors = new List<ApiError>();
        foreach (var (key, entry) in context.ModelState)
        {
            foreach (var error in entry.Errors)
            {
                var item = Describe(key, error.ErrorMessage, error.Exception);
                if (!errors.Contains(item))
                {
                    errors.Add(item);
                }
            }
        }

        var body = ApiResponse.Failure("One or more fields are invalid.", errors, TraceIds.For(context.HttpContext));
        return new BadRequestObjectResult(body);
    }

    private static ApiError Describe(string key, string message, Exception? exception)
    {
        if (exception is JsonException || key == JsonRoot)
        {
            return new ApiError(ErrorCodes.ValidationFailed, null, "The request body is not valid JSON for this endpoint.");
        }

        var field = ToFieldName(key);
        var text = string.IsNullOrWhiteSpace(message) ? $"{field} is invalid." : message;
        return new ApiError(ErrorCodes.ValidationFailed, field, text);
    }

    public static string? ToFieldName(string key)
    {
        if (string.IsNullOrWhiteSpace(key))
        {
            return null;
        }

        var path = key.StartsWith(JsonPropertyPrefix, StringComparison.Ordinal) ? key[JsonPropertyPrefix.Length..] : key;
        return string.Join('.', path.Split('.').Select(JsonNamingPolicy.CamelCase.ConvertName));
    }
}
