using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.Identity.Repositories.Entities;
using ExeGroup.Identity.Repositories.Interfaces;
using ExeGroup.Identity.Services.Security;
using ExeGroup.Identity.Services.Users;

namespace ExeGroup.Identity.Services.Auth;

public sealed record IssuedAccessToken(string Token, DateTime ExpiresAtUtc);

public interface IAccessTokenIssuer
{
    TimeSpan RefreshTokenLifetime { get; }

    IssuedAccessToken Issue(UserModel user);
}

public sealed record SignInModel(
    string AccessToken,
    DateTime AccessTokenExpiresAt,
    string RefreshToken,
    DateTime RefreshTokenExpiresAt,
    UserModel User);

public sealed record ProfileChanges(string FullName, string? CurrentPassword, string? NewPassword);

public interface IAuthService
{
    Task<SignInModel> LoginAsync(string email, string password, CancellationToken cancellationToken);

    Task<SignInModel> RefreshAsync(string refreshToken, CancellationToken cancellationToken);

    Task LogoutAsync(string refreshToken, CancellationToken cancellationToken);

    Task<UserModel> GetMeAsync(CancellationToken cancellationToken);

    Task<UserModel> UpdateMeAsync(ProfileChanges changes, CancellationToken cancellationToken);
}

public sealed class AuthService(
    IUserRepository users,
    IRefreshTokenRepository refreshTokens,
    IPasswordHasher hasher,
    IAccessTokenIssuer issuer,
    ICurrentUser currentUser,
    IClock clock) : IAuthService
{
    private static readonly Lazy<string> UnknownUserHash = new(() => new Pbkdf2PasswordHasher().Hash(Guid.NewGuid().ToString()));

    public async Task<SignInModel> LoginAsync(string email, string password, CancellationToken cancellationToken)
    {
        var user = await users.FindByEmailAsync(UserService.NormalizeEmail(email), cancellationToken);
        var valid = hasher.Verify(user?.PasswordHash ?? UnknownUserHash.Value, password);
        if (user is null || !valid)
        {
            throw new UnauthorizedException("The e-mail or password is incorrect.");
        }

        EnsureActive(user);
        return await SignInAsync(user, cancellationToken);
    }

    public async Task<SignInModel> RefreshAsync(string refreshToken, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var stored = await refreshTokens.FindByHashAsync(RefreshTokens.HashOf(refreshToken), cancellationToken)
            ?? throw new UnauthorizedException("The refresh token is not valid.");
        if (stored.RevokedAt is not null)
        {
            await RevokeDescendantsAsync(stored, now, cancellationToken);
            throw new UnauthorizedException("The refresh token was already used. Sign in again.");
        }

        if (stored.ExpiresAt <= now)
        {
            throw new UnauthorizedException("The refresh token has expired. Sign in again.");
        }

        if (stored.User.Status == UserStatuses.Locked)
        {
            stored.RevokedAt = now;
            await refreshTokens.SaveChangesAsync(cancellationToken);
            throw new ForbiddenException("This account is locked.");
        }

        var signIn = await SignInAsync(stored.User, cancellationToken, replaced: stored);
        return signIn;
    }

    public async Task LogoutAsync(string refreshToken, CancellationToken cancellationToken)
    {
        var stored = await refreshTokens.FindByHashAsync(RefreshTokens.HashOf(refreshToken), cancellationToken);
        if (stored is { RevokedAt: null })
        {
            stored.RevokedAt = clock.UtcNow;
            await refreshTokens.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<UserModel> GetMeAsync(CancellationToken cancellationToken) =>
        (await RequireMeAsync(cancellationToken)).ToModel();

    public async Task<UserModel> UpdateMeAsync(ProfileChanges changes, CancellationToken cancellationToken)
    {
        var user = await RequireMeAsync(cancellationToken);
        user.FullName = changes.FullName.Trim();
        user.UpdatedAt = clock.UtcNow;
        var changingPassword = !string.IsNullOrEmpty(changes.NewPassword);
        if (changingPassword)
        {
            if (string.IsNullOrEmpty(changes.CurrentPassword) || !hasher.Verify(user.PasswordHash, changes.CurrentPassword))
            {
                throw new ValidationFailedException("currentPassword", "The current password is incorrect.");
            }

            user.PasswordHash = hasher.Hash(changes.NewPassword!);
        }

        await users.SaveChangesAsync(cancellationToken);
        if (changingPassword)
        {
            await refreshTokens.RevokeAllAsync(user.UserId, clock.UtcNow, cancellationToken);
        }

        return user.ToModel();
    }

    private async Task<SignInModel> SignInAsync(User user, CancellationToken cancellationToken, RefreshToken? replaced = null)
    {
        var now = clock.UtcNow;
        var token = RefreshTokens.NewToken();
        var stored = new RefreshToken
        {
            RefreshTokenId = Guid.NewGuid(),
            UserId = user.UserId,
            TokenHash = RefreshTokens.HashOf(token),
            CreatedAt = now,
            ExpiresAt = now.Add(issuer.RefreshTokenLifetime),
        };
        refreshTokens.Add(stored);
        if (replaced is not null)
        {
            replaced.RevokedAt = now;
            replaced.ReplacedByTokenId = stored.RefreshTokenId;
        }

        await refreshTokens.SaveChangesAsync(cancellationToken);
        var model = user.ToModel();
        var access = issuer.Issue(model);
        return new SignInModel(access.Token, access.ExpiresAtUtc, token, stored.ExpiresAt, model);
    }

    private async Task RevokeDescendantsAsync(RefreshToken reused, DateTime now, CancellationToken cancellationToken)
    {
        var tokens = (await refreshTokens.ListForUserAsync(reused.UserId, cancellationToken)).ToDictionary(token => token.RefreshTokenId);
        for (var next = reused.ReplacedByTokenId; next is { } id && tokens.TryGetValue(id, out var token); next = token.ReplacedByTokenId)
        {
            token.RevokedAt ??= now;
        }

        await refreshTokens.SaveChangesAsync(cancellationToken);
    }

    private async Task<User> RequireMeAsync(CancellationToken cancellationToken)
    {
        var id = currentUser.RequireUserId();
        return await users.FindAsync(id, cancellationToken) ?? throw new NotFoundException("User", id);
    }

    private static void EnsureActive(User user)
    {
        if (user.Status == UserStatuses.Locked)
        {
            throw new ForbiddenException("This account is locked.");
        }
    }
}
