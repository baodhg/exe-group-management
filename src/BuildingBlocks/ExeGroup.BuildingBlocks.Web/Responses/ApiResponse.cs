using System.Text.Json.Serialization;
using ExeGroup.BuildingBlocks.Paging;

namespace ExeGroup.BuildingBlocks.Web.Responses;

public sealed record ApiError(string Code, string? Field, string Message);

public sealed record PaginationMetadata(int Page, int PageSize, int TotalItems, int TotalPages)
{
    public static PaginationMetadata From<T>(PagedResult<T> page) =>
        new(page.Page, page.PageSize, page.TotalItems, page.TotalPages);
}

public interface IApiResponse
{
    string? TraceId { get; set; }
}

public sealed class ApiResponse<TData> : IApiResponse
{
    public bool Success { get; init; }

    public string Message { get; init; } = string.Empty;

    public TData? Data { get; init; }

    public IReadOnlyList<ApiError>? Errors { get; init; }

    public string? TraceId { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public PaginationMetadata? Pagination { get; init; }
}

public static class ApiResponse
{
    public static ApiResponse<TData> Ok<TData>(TData data, string message) => new()
    {
        Success = true,
        Message = message,
        Data = data,
    };

    public static ApiResponse<IReadOnlyList<TData>> Page<TData>(
        IReadOnlyList<TData> items,
        PaginationMetadata pagination,
        string message) => new()
        {
            Success = true,
            Message = message,
            Data = items,
            Pagination = pagination,
        };

    public static ApiResponse<object> Failure(string message, IReadOnlyList<ApiError> errors, string? traceId) => new()
    {
        Success = false,
        Message = message,
        Errors = errors,
        TraceId = traceId,
    };
}
