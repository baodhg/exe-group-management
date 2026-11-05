namespace ExeGroup.Identity.Repositories.Entities;

public sealed class RefreshToken
{
    public Guid RefreshTokenId { get; set; }

    public Guid UserId { get; set; }

    public string TokenHash { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? RevokedAt { get; set; }

    public Guid? ReplacedByTokenId { get; set; }

    public User User { get; set; } = null!;
}
