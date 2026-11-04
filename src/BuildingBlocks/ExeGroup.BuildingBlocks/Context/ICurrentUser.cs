using ExeGroup.BuildingBlocks.Errors;

namespace ExeGroup.BuildingBlocks.Context;

public interface ICurrentUser
{
    Guid? UserId { get; }

    bool IsAuthenticated { get; }

    IReadOnlyCollection<string> Roles { get; }

    bool IsInRole(string role);

    Guid RequireUserId() => UserId ?? throw new UnauthorizedException();
}
