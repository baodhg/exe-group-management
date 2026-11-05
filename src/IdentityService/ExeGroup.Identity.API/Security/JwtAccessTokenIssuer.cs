using System.Security.Claims;
using ExeGroup.BuildingBlocks.Web.Security;
using ExeGroup.Identity.Services.Auth;
using ExeGroup.Identity.Services.Users;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;

namespace ExeGroup.Identity.API.Security;

public sealed class JwtAccessTokenIssuer(AccessTokenFactory factory, IOptions<JwtOptions> options) : IAccessTokenIssuer
{
    public TimeSpan RefreshTokenLifetime => TimeSpan.FromDays(options.Value.RefreshTokenDays);

    public IssuedAccessToken Issue(UserModel user)
    {
        var token = factory.Create(
            user.Id,
            user.Roles,
            [new Claim(JwtRegisteredClaimNames.Name, user.FullName), new Claim(JwtRegisteredClaimNames.Email, user.Email)]);
        return new IssuedAccessToken(token.Token, token.ExpiresAtUtc);
    }
}
