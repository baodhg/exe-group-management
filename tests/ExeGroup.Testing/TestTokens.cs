using ExeGroup.BuildingBlocks.Web.Security;

namespace ExeGroup.Testing;

public static class TestTokens
{
    public const string Issuer = "exe-group-system";
    public const string Audience = "exe-group-clients";
    public const string SigningKey = "test-signing-key-that-is-long-enough-for-hs256";

    public static JwtOptions Options { get; } = new()
    {
        Issuer = Issuer,
        Audience = Audience,
        SigningKey = SigningKey,
        AccessTokenMinutes = 60,
    };

    public static IReadOnlyDictionary<string, string?> Configuration { get; } = new Dictionary<string, string?>
    {
        ["Jwt:Issuer"] = Issuer,
        ["Jwt:Audience"] = Audience,
        ["Jwt:SigningKey"] = SigningKey,
    };

    public static string For(Guid userId, params string[] roles) =>
        new AccessTokenFactory(Options).Create(userId, roles).Token;

    public static string Expired(Guid userId, params string[] roles) =>
        new AccessTokenFactory(Options).Create(userId, roles, DateTime.UtcNow.AddHours(-2), TimeSpan.FromMinutes(5)).Token;
}
