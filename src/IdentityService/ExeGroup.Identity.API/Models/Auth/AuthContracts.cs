using System.ComponentModel.DataAnnotations;
using ExeGroup.Identity.API.Models.Users;
using ExeGroup.Identity.Services.Auth;

namespace ExeGroup.Identity.API.Models.Auth;

public sealed class LoginRequest
{
    [Required]
    [StringLength(255)]
    public string? Email { get; init; }

    [Required]
    [StringLength(100)]
    public string? Password { get; init; }
}

public sealed class RefreshTokenRequest
{
    [Required]
    [StringLength(200)]
    public string? RefreshToken { get; init; }
}

public sealed class UpdateProfileRequest
{
    [Required]
    [StringLength(150, MinimumLength = 1)]
    public string? FullName { get; init; }

    [StringLength(100)]
    public string? CurrentPassword { get; init; }

    [StringLength(100, MinimumLength = 8)]
    public string? NewPassword { get; init; }
}

public sealed record SignInResponse(
    string AccessToken,
    DateTime AccessTokenExpiresAt,
    string RefreshToken,
    DateTime RefreshTokenExpiresAt,
    UserResponse User);

public static class AuthMappings
{
    public static SignInResponse ToResponse(this SignInModel model) =>
        new(model.AccessToken, model.AccessTokenExpiresAt, model.RefreshToken, model.RefreshTokenExpiresAt, model.User.ToResponse());

    public static ProfileChanges ToChanges(this UpdateProfileRequest request) =>
        new(request.FullName!, request.CurrentPassword, request.NewPassword);
}
