using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;

namespace ExeGroup.Identity.IntegrationTests;

public sealed record SignIn(string AccessToken, string RefreshToken, Guid UserId);

public static class IdentityApi
{
    public static readonly string Password = NewPassword();

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public static async Task<Guid> CreateUserAsync(
        this IdentityApiFixture fixture,
        string email,
        string role = Roles.Student,
        string? userCode = null,
        string? password = null)
    {
        var response = await fixture.Api.ClientAs(Roles.Administrator).PostAsJsonAsync(
            "/api/v1/users",
            new { email, fullName = "Test User", userCode = userCode ?? (role == Roles.Student ? $"SE{Random.Shared.Next(100000, 999999)}" : null), password = password ?? Password, roles = new[] { role } },
            Ct);
        response.EnsureSuccessStatusCode();
        return (await BodyAsync(response)).GetProperty("data").GetProperty("id").GetGuid();
    }

    public static async Task<HttpResponseMessage> LoginAsync(this IdentityApiFixture fixture, string email, string? password = null) =>
        await fixture.Api.AnonymousClient().PostAsJsonAsync("/api/v1/auth/login", new { email, password = password ?? Password }, Ct);

    public static async Task<SignIn> SignInAsync(this IdentityApiFixture fixture, string email, string? password = null)
    {
        var response = await fixture.LoginAsync(email, password);
        response.EnsureSuccessStatusCode();
        return ReadSignIn(await BodyAsync(response));
    }

    public static async Task<HttpResponseMessage> RefreshAsync(this IdentityApiFixture fixture, string refreshToken) =>
        await fixture.Api.AnonymousClient().PostAsJsonAsync("/api/v1/auth/refresh-token", new { refreshToken }, Ct);

    public static HttpClient ClientWith(this IdentityApiFixture fixture, string accessToken)
    {
        var client = fixture.Api.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return client;
    }

    public static SignIn ReadSignIn(JsonElement body)
    {
        var data = body.GetProperty("data");
        return new SignIn(
            data.GetProperty("accessToken").GetString()!,
            data.GetProperty("refreshToken").GetString()!,
            data.GetProperty("user").GetProperty("id").GetGuid());
    }

    public static async Task<JsonElement> BodyAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement;

    public static async Task<string?> ErrorCodeAsync(HttpResponseMessage response) =>
        (await BodyAsync(response)).GetProperty("errors")[0].GetProperty("code").GetString();

    public static string NewPassword() => $"P-{Guid.NewGuid():N}";

    public static string NewEmail() => $"user{Guid.NewGuid():N}@fpt.edu.vn";
}
