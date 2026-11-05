using System.Net;
using System.Net.Http.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Identity.Repositories.Data;
using ExeGroup.Identity.Repositories.Entities;
using ExeGroup.Identity.Services.Security;
using Microsoft.Extensions.DependencyInjection;
using static ExeGroup.Identity.IntegrationTests.IdentityApi;

namespace ExeGroup.Identity.IntegrationTests;

public sealed class AuthEndpointTests(IdentityApiFixture fixture) : IClassFixture<IdentityApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Signing_in_returns_tokens_that_open_my_account()
    {
        var email = NewEmail();
        await fixture.CreateUserAsync(email);

        var signIn = await fixture.SignInAsync(email.ToUpperInvariant());
        var me = await BodyAsync(await fixture.ClientWith(signIn.AccessToken).GetAsync("/api/v1/auth/me", Ct));

        Assert.Equal(email, me.GetProperty("data").GetProperty("email").GetString());
        Assert.Equal(Roles.Student, me.GetProperty("data").GetProperty("roles")[0].GetString());
    }

    [Fact]
    public async Task A_wrong_password_or_an_unknown_e_mail_is_refused()
    {
        var email = NewEmail();
        await fixture.CreateUserAsync(email);

        var wrongPassword = await fixture.LoginAsync(email, NewPassword());
        var unknown = await fixture.LoginAsync(NewEmail());

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);
        Assert.Equal("UNAUTHORIZED", await ErrorCodeAsync(wrongPassword));
    }

    [Fact]
    public async Task A_locked_account_cannot_sign_in_and_its_sessions_end()
    {
        var email = NewEmail();
        var userId = await fixture.CreateUserAsync(email, Roles.Lecturer);
        var signIn = await fixture.SignInAsync(email);

        var locked = await fixture.Api.ClientAs(Roles.Administrator).PutAsJsonAsync(
            $"/api/v1/users/{userId}",
            new { fullName = "Test User", status = "Locked", roles = new[] { Roles.Lecturer } },
            Ct);
        var login = await fixture.LoginAsync(email);
        var refresh = await fixture.RefreshAsync(signIn.RefreshToken);

        Assert.Equal(HttpStatusCode.OK, locked.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, login.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
    }

    [Fact]
    public async Task Refreshing_rotates_the_token_and_reusing_an_old_one_revokes_the_newer_ones()
    {
        var email = NewEmail();
        await fixture.CreateUserAsync(email);
        var first = await fixture.SignInAsync(email);

        var rotated = await fixture.RefreshAsync(first.RefreshToken);
        var second = ReadSignIn(await BodyAsync(rotated));
        var reused = await fixture.RefreshAsync(first.RefreshToken);
        var afterReuse = await fixture.RefreshAsync(second.RefreshToken);

        Assert.Equal(HttpStatusCode.OK, rotated.StatusCode);
        Assert.NotEqual(first.RefreshToken, second.RefreshToken);
        Assert.Equal(HttpStatusCode.Unauthorized, reused.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, afterReuse.StatusCode);
    }

    [Fact]
    public async Task An_expired_refresh_token_is_refused()
    {
        var email = NewEmail();
        var userId = await fixture.CreateUserAsync(email);
        var token = RefreshTokens.NewToken();
        await using (var scope = fixture.Api.Services.CreateAsyncScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
            database.RefreshTokens.Add(new RefreshToken
            {
                RefreshTokenId = Guid.NewGuid(),
                UserId = userId,
                TokenHash = RefreshTokens.HashOf(token),
                CreatedAt = DateTime.UtcNow.AddDays(-8),
                ExpiresAt = DateTime.UtcNow.AddDays(-1),
            });
            await database.SaveChangesAsync(Ct);
        }

        var response = await fixture.RefreshAsync(token);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Logging_out_revokes_the_refresh_token()
    {
        var email = NewEmail();
        await fixture.CreateUserAsync(email);
        var signIn = await fixture.SignInAsync(email);

        var logout = await fixture.Api.AnonymousClient().PostAsJsonAsync("/api/v1/auth/logout", new { refreshToken = signIn.RefreshToken }, Ct);
        var refresh = await fixture.RefreshAsync(signIn.RefreshToken);

        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
    }

    [Fact]
    public async Task I_change_my_name_and_my_password_with_the_current_one()
    {
        var email = NewEmail();
        await fixture.CreateUserAsync(email);
        var client = fixture.ClientWith((await fixture.SignInAsync(email)).AccessToken);
        var newPassword = NewPassword();

        var wrongCurrent = await client.PutAsJsonAsync("/api/v1/auth/me", new { fullName = "New Name", currentPassword = NewPassword(), newPassword }, Ct);
        var changed = await client.PutAsJsonAsync("/api/v1/auth/me", new { fullName = "New Name", currentPassword = Password, newPassword }, Ct);
        var withOldPassword = await fixture.LoginAsync(email);
        var withNewPassword = await fixture.LoginAsync(email, newPassword);

        Assert.Equal(HttpStatusCode.BadRequest, wrongCurrent.StatusCode);
        Assert.Equal("New Name", (await BodyAsync(changed)).GetProperty("data").GetProperty("fullName").GetString());
        Assert.Equal(HttpStatusCode.Unauthorized, withOldPassword.StatusCode);
        Assert.Equal(HttpStatusCode.OK, withNewPassword.StatusCode);
    }
}
