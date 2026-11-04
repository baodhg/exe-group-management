namespace ExeGroup.BuildingBlocks.Errors;

public abstract class AppException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

public sealed class NotFoundException(string resource, object key)
    : AppException(ErrorCodes.NotFound, $"{resource} '{key}' was not found.")
{
    public string Resource { get; } = resource;
}

public sealed class ConflictException(string code, string message) : AppException(code, message);

public sealed class UnauthorizedException(string message = "A signed-in user is required.")
    : AppException(ErrorCodes.Unauthorized, message);

public sealed class ForbiddenException(string message = "You are not allowed to perform this action.")
    : AppException(ErrorCodes.Forbidden, message);

public sealed record FieldError(string? Field, string Message, string Code = ErrorCodes.ValidationFailed);

public sealed class ValidationFailedException : AppException
{
    public ValidationFailedException(IReadOnlyList<FieldError> errors)
        : base(ErrorCodes.ValidationFailed, "One or more fields are invalid.")
    {
        Errors = errors;
    }

    public ValidationFailedException(string field, string message)
        : this([new FieldError(field, message)])
    {
    }

    public IReadOnlyList<FieldError> Errors { get; }
}
