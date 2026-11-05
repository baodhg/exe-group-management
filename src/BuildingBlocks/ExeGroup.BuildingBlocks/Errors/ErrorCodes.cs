namespace ExeGroup.BuildingBlocks.Errors;

public static class ErrorCodes
{
    public const string ValidationFailed = "VALIDATION_FAILED";
    public const string Unauthorized = "UNAUTHORIZED";
    public const string Forbidden = "FORBIDDEN";
    public const string NotFound = "NOT_FOUND";
    public const string MethodNotAllowed = "METHOD_NOT_ALLOWED";
    public const string NotAcceptable = "NOT_ACCEPTABLE";
    public const string UnsupportedMediaType = "UNSUPPORTED_MEDIA_TYPE";
    public const string Conflict = "CONFLICT";
    public const string Duplicate = "DUPLICATE";
    public const string ConcurrencyConflict = "CONCURRENCY_CONFLICT";
    public const string TooManyRequests = "TOO_MANY_REQUESTS";
    public const string InternalError = "INTERNAL_ERROR";
    public const string UpstreamUnavailable = "UPSTREAM_UNAVAILABLE";
    public const string BadRequest = "BAD_REQUEST";
}
