using System.ComponentModel.DataAnnotations;
using ExeGroup.Identity.Services.Users;

namespace ExeGroup.Identity.API.Models.Users;

public sealed record UserResponse(
    Guid Id,
    string Email,
    string? UserCode,
    string FullName,
    string Status,
    IReadOnlyList<string> Roles,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed class CreateUserRequest
{
    [Required]
    [EmailAddress]
    [StringLength(255)]
    public string? Email { get; init; }

    [Required]
    [StringLength(150, MinimumLength = 1)]
    public string? FullName { get; init; }

    [StringLength(20)]
    public string? UserCode { get; init; }

    [Required]
    [StringLength(100, MinimumLength = 8)]
    public string? Password { get; init; }

    [Required]
    [MinLength(1)]
    public List<string>? Roles { get; init; }
}

public sealed class UpdateUserRequest
{
    [Required]
    [StringLength(150, MinimumLength = 1)]
    public string? FullName { get; init; }

    [StringLength(20)]
    public string? UserCode { get; init; }

    [Required]
    public string? Status { get; init; }

    [Required]
    [MinLength(1)]
    public List<string>? Roles { get; init; }
}

public sealed class ImportStudentsRequest
{
    [StringLength(100, MinimumLength = 8)]
    public string? DefaultPassword { get; init; }

    [Required]
    [MinLength(1)]
    [MaxLength(1000)]
    public List<ImportStudentItem>? Students { get; init; }
}

public sealed class ImportStudentItem
{
    [Required]
    [EmailAddress]
    [StringLength(255)]
    public string? Email { get; init; }

    [Required]
    [StringLength(150, MinimumLength = 1)]
    public string? FullName { get; init; }

    [Required]
    [StringLength(20, MinimumLength = 1)]
    public string? UserCode { get; init; }

    [StringLength(100, MinimumLength = 8)]
    public string? Password { get; init; }
}

public sealed record ImportedAccountResponse(string Email, Guid UserId, bool Created);

public static class UserMappings
{
    public static UserResponse ToResponse(this UserModel model) =>
        new(model.Id, model.Email, model.UserCode, model.FullName, model.Status, model.Roles, model.CreatedAt, model.UpdatedAt);

    public static NewUser ToInput(this CreateUserRequest request) =>
        new(request.Email!, request.FullName!, request.UserCode, request.Password!, request.Roles!);

    public static UserChanges ToChanges(this UpdateUserRequest request) =>
        new(request.FullName!, request.UserCode, request.Status!, request.Roles!);

    public static ImportedStudent ToInput(this ImportStudentItem item) =>
        new(item.Email!, item.FullName!, item.UserCode!, item.Password);
}
