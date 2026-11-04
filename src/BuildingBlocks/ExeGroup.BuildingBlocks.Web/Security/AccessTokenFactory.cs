using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace ExeGroup.BuildingBlocks.Web.Security;

public sealed record AccessToken(string Token, DateTime ExpiresAtUtc);

public sealed class AccessTokenFactory(JwtOptions options)
{
    public const string RoleClaim = "role";

    public static SymmetricSecurityKey KeyFrom(JwtOptions options) => new(Encoding.UTF8.GetBytes(options.SigningKey));

    public AccessToken Create(Guid userId, IEnumerable<string> roles, IEnumerable<Claim>? extraClaims = null) =>
        Create(userId, roles, DateTime.UtcNow, TimeSpan.FromMinutes(options.AccessTokenMinutes), extraClaims);

    public AccessToken Create(
        Guid userId,
        IEnumerable<string> roles,
        DateTime issuedAtUtc,
        TimeSpan lifetime,
        IEnumerable<Claim>? extraClaims = null)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
        };
        claims.AddRange(roles.Select(role => new Claim(RoleClaim, role)));
        if (extraClaims is not null)
        {
            claims.AddRange(extraClaims);
        }

        var expires = issuedAtUtc.Add(lifetime);
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = options.Issuer,
            Audience = options.Audience,
            Subject = new ClaimsIdentity(claims),
            IssuedAt = issuedAtUtc,
            NotBefore = issuedAtUtc,
            Expires = expires,
            SigningCredentials = new SigningCredentials(KeyFrom(options), SecurityAlgorithms.HmacSha256),
        };

        return new AccessToken(new JsonWebTokenHandler().CreateToken(descriptor), expires);
    }
}
