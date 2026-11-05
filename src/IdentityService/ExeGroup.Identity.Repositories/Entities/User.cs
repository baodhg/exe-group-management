namespace ExeGroup.Identity.Repositories.Entities;

public sealed class User
{
    public Guid UserId { get; set; }

    public string Email { get; set; } = string.Empty;

    public string? UserCode { get; set; }

    public string PasswordHash { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public string Status { get; set; } = UserStatuses.Active;

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public ICollection<UserRole> UserRoles { get; } = [];

    public ICollection<RefreshToken> RefreshTokens { get; } = [];
}

public static class UserStatuses
{
    public const string Active = "Active";
    public const string Locked = "Locked";
}
