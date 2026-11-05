using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Identity.Repositories.Entities;

namespace ExeGroup.Identity.Repositories.Interfaces;

public interface IUserRepository
{
    Task<PagedResult<User>> GetPageAsync(ListQuery query, string? role, string? status, CancellationToken cancellationToken);

    Task<User?> FindAsync(Guid userId, CancellationToken cancellationToken);

    Task<User?> FindByEmailAsync(string email, CancellationToken cancellationToken);

    Task<List<User>> FindByEmailsAsync(IReadOnlyCollection<string> emails, CancellationToken cancellationToken);

    Task<List<User>> FindByUserCodesAsync(IReadOnlyCollection<string> userCodes, CancellationToken cancellationToken);

    Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken);

    Task<bool> UserCodeExistsAsync(string userCode, Guid? exceptUserId, CancellationToken cancellationToken);

    void Add(User user);

    Task SaveChangesAsync(CancellationToken cancellationToken);

    Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken);
}

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> FindByHashAsync(string tokenHash, CancellationToken cancellationToken);

    Task<List<RefreshToken>> ListForUserAsync(Guid userId, CancellationToken cancellationToken);

    Task<int> RevokeAllAsync(Guid userId, DateTime revokedAt, CancellationToken cancellationToken);

    void Add(RefreshToken token);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
