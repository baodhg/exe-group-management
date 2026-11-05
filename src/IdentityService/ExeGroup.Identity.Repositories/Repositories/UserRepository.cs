using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Identity.Repositories.Data;
using ExeGroup.Identity.Repositories.Entities;
using ExeGroup.Identity.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Identity.Repositories.Repositories;

public sealed class UserRepository(IdentityDbContext context) : IUserRepository
{
    private static readonly SortMap<User> Sorting = new SortMap<User>()
        .Add("email", user => user.Email)
        .Add("fullName", user => user.FullName)
        .Add("userCode", user => user.UserCode)
        .Add("status", user => user.Status)
        .Add("createdAt", user => user.CreatedAt)
        .ByDefault("createdAt", descending: true)
        .TieBreaker(user => user.UserId);

    private IQueryable<User> WithRoles => context.Users.Include(user => user.UserRoles).ThenInclude(userRole => userRole.Role);

    public Task<PagedResult<User>> GetPageAsync(ListQuery query, string? role, string? status, CancellationToken cancellationToken)
    {
        var users = WithRoles.AsNoTracking();
        if (query.Search is { } search)
        {
            users = users.Where(user => user.FullName.Contains(search) || user.Email.Contains(search) || (user.UserCode != null && user.UserCode.Contains(search)));
        }

        if (role is not null)
        {
            users = users.Where(user => user.UserRoles.Any(userRole => userRole.Role.Name == role));
        }

        if (status is not null)
        {
            users = users.Where(user => user.Status == status);
        }

        return users.ToPagedResultAsync(query, Sorting, cancellationToken);
    }

    public Task<User?> FindAsync(Guid userId, CancellationToken cancellationToken) =>
        WithRoles.SingleOrDefaultAsync(user => user.UserId == userId, cancellationToken);

    public Task<User?> FindByEmailAsync(string email, CancellationToken cancellationToken) =>
        WithRoles.SingleOrDefaultAsync(user => user.Email == email, cancellationToken);

    public Task<List<User>> FindByEmailsAsync(IReadOnlyCollection<string> emails, CancellationToken cancellationToken) =>
        WithRoles.Where(user => emails.Contains(user.Email)).ToListAsync(cancellationToken);

    public Task<List<User>> FindByUserCodesAsync(IReadOnlyCollection<string> userCodes, CancellationToken cancellationToken) =>
        context.Users.AsNoTracking().Where(user => user.UserCode != null && userCodes.Contains(user.UserCode)).ToListAsync(cancellationToken);

    public Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken) =>
        context.Users.AnyAsync(user => user.Email == email, cancellationToken);

    public Task<bool> UserCodeExistsAsync(string userCode, Guid? exceptUserId, CancellationToken cancellationToken) =>
        context.Users.AnyAsync(user => user.UserCode == userCode && user.UserId != exceptUserId, cancellationToken);

    public void Add(User user) => context.Users.Add(user);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);

    public Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken) => context.TrySaveChangesAsync(cancellationToken);
}

public sealed class RefreshTokenRepository(IdentityDbContext context) : IRefreshTokenRepository
{
    public Task<RefreshToken?> FindByHashAsync(string tokenHash, CancellationToken cancellationToken) =>
        context.RefreshTokens
            .Include(token => token.User).ThenInclude(user => user.UserRoles).ThenInclude(userRole => userRole.Role)
            .SingleOrDefaultAsync(token => token.TokenHash == tokenHash, cancellationToken);

    public Task<List<RefreshToken>> ListForUserAsync(Guid userId, CancellationToken cancellationToken) =>
        context.RefreshTokens.Where(token => token.UserId == userId).ToListAsync(cancellationToken);

    public Task<int> RevokeAllAsync(Guid userId, DateTime revokedAt, CancellationToken cancellationToken) =>
        context.RefreshTokens
            .Where(token => token.UserId == userId && token.RevokedAt == null)
            .ExecuteUpdateAsync(update => update.SetProperty(token => token.RevokedAt, revokedAt), cancellationToken);

    public void Add(RefreshToken token) => context.RefreshTokens.Add(token);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);
}
