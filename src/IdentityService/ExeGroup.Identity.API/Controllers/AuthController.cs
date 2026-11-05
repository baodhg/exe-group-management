using Asp.Versioning;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Identity.API.Models.Auth;
using ExeGroup.Identity.API.Models.Users;
using ExeGroup.Identity.Services.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.Identity.API.Controllers;

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/auth")]
[Tags("Auth")]
public sealed class AuthController(IAuthService auth) : ApiControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    [EndpointSummary("Sign in with e-mail and password; returns an access token and a refresh token")]
    [ProducesResponseType<ApiResponse<SignInResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken) =>
        Success((await auth.LoginAsync(request.Email!, request.Password!, cancellationToken)).ToResponse(), "Signed in");

    [HttpPost("refresh-token")]
    [AllowAnonymous]
    [EndpointSummary("Exchange a refresh token for a new pair; the old one stops working")]
    [ProducesResponseType<ApiResponse<SignInResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenRequest request, CancellationToken cancellationToken) =>
        Success((await auth.RefreshAsync(request.RefreshToken!, cancellationToken)).ToResponse(), "Token refreshed");

    [HttpPost("logout")]
    [AllowAnonymous]
    [EndpointSummary("Revoke a refresh token")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout([FromBody] RefreshTokenRequest request, CancellationToken cancellationToken)
    {
        await auth.LogoutAsync(request.RefreshToken!, cancellationToken);
        return NoContent();
    }

    [HttpGet("me")]
    [EndpointSummary("Read my account")]
    [ProducesResponseType<ApiResponse<UserResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Me(CancellationToken cancellationToken) =>
        Success((await auth.GetMeAsync(cancellationToken)).ToResponse(), "Account loaded");

    [HttpPut("me")]
    [EndpointSummary("Change my name, and my password when the current one is given")]
    [ProducesResponseType<ApiResponse<UserResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateMe([FromBody] UpdateProfileRequest request, CancellationToken cancellationToken) =>
        Success((await auth.UpdateMeAsync(request.ToChanges(), cancellationToken)).ToResponse(), "Account updated");
}
