using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.BuildingBlocks.Web.Responses;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ExeGroup.BuildingBlocks.Web.Errors;

public sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            logger.LogInformation("Request {Method} {Path} was cancelled by the client", context.Request.Method, context.Request.Path);
        }
        catch (Exception exception) when (!context.Response.HasStarted)
        {
            var failure = Describe(exception);
            if (failure.StatusCode >= StatusCodes.Status500InternalServerError)
            {
                logger.LogError(exception, "Unhandled exception while processing {Method} {Path}", context.Request.Method, context.Request.Path);
            }
            else
            {
                logger.LogWarning("Request {Method} {Path} failed with {StatusCode}: {Reason}", context.Request.Method, context.Request.Path, failure.StatusCode, exception.Message);
            }

            context.Response.Clear();
            await EnvelopeWriter.WriteFailureAsync(context, failure.StatusCode, failure.Message, failure.Errors);
        }
    }

    private static Failure Describe(Exception exception) => exception switch
    {
        ValidationFailedException validation => new(
            StatusCodes.Status400BadRequest,
            validation.Message,
            validation.Errors.Select(error => new ApiError(error.Code, error.Field, error.Message)).ToList()),
        NotFoundException notFound => Single(StatusCodes.Status404NotFound, "Resource not found", notFound),
        UnauthorizedException unauthorized => Single(StatusCodes.Status401Unauthorized, "Authentication required", unauthorized),
        ForbiddenException forbidden => Single(StatusCodes.Status403Forbidden, "Forbidden", forbidden),
        ConflictException conflict => Single(StatusCodes.Status409Conflict, "The request conflicts with a business rule", conflict),
        AppException other => Single(StatusCodes.Status400BadRequest, "Bad request", other),
        DbUpdateConcurrencyException => new(
            StatusCodes.Status409Conflict,
            "The resource was changed by someone else",
            [new ApiError(ErrorCodes.ConcurrencyConflict, null, "Reload the resource and try again.")]),
        DbUpdateException update when update.IsUniqueViolation() => new(
            StatusCodes.Status409Conflict,
            "The resource already exists",
            [new ApiError(ErrorCodes.Duplicate, null, "A resource with the same unique value already exists.")]),
        BadHttpRequestException badRequest => new(
            badRequest.StatusCode,
            "Bad request",
            [new ApiError(ErrorCodes.BadRequest, null, "The request could not be read by the server.")]),
        _ => new(
            StatusCodes.Status500InternalServerError,
            "Internal server error",
            [new ApiError(ErrorCodes.InternalError, null, "An unexpected error occurred. Quote the traceId when reporting this problem.")]),
    };

    private static Failure Single(int statusCode, string message, AppException exception) =>
        new(statusCode, message, [new ApiError(exception.Code, null, exception.Message)]);

    private sealed record Failure(int StatusCode, string Message, IReadOnlyList<ApiError> Errors);
}
