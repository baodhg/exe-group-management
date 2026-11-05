using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Identity.Repositories.Entities;
using ExeGroup.Identity.Repositories.Interfaces;
using ExeGroup.Identity.Services.Security;

namespace ExeGroup.Identity.Services.Users;

public interface IUserService
{
    Task<PagedResult<UserModel>> ListAsync(ListQuery query, string? role, string? status, CancellationToken cancellationToken);

    Task<UserModel> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<UserModel> CreateAsync(NewUser input, CancellationToken cancellationToken);

    Task<UserModel> UpdateAsync(Guid id, UserChanges changes, CancellationToken cancellationToken);

    Task<IReadOnlyList<ImportedAccount>> ImportStudentsAsync(
        IReadOnlyList<ImportedStudent> students,
        string? defaultPassword,
        CancellationToken cancellationToken);
}

public sealed class UserService(
    IUserRepository users,
    IRefreshTokenRepository refreshTokens,
    IPasswordHasher hasher,
    ICurrentUser currentUser,
    IClock clock) : IUserService
{
    public async Task<PagedResult<UserModel>> ListAsync(ListQuery query, string? role, string? status, CancellationToken cancellationToken)
    {
        var roleName = role is null ? null : Roles.All.FirstOrDefault(name => string.Equals(name, role.Trim(), StringComparison.OrdinalIgnoreCase)) ?? role.Trim();
        var statusName = string.IsNullOrWhiteSpace(status) ? null : status.Trim();
        return (await users.GetPageAsync(query, roleName, statusName, cancellationToken)).Map(user => user.ToModel());
    }

    public async Task<UserModel> GetAsync(Guid id, CancellationToken cancellationToken) =>
        (await RequireAsync(id, cancellationToken)).ToModel();

    public async Task<UserModel> CreateAsync(NewUser input, CancellationToken cancellationToken)
    {
        var email = NormalizeEmail(input.Email);
        var userCode = NormalizeCode(input.UserCode);
        var roles = NormalizeRoles(input.Roles, userCode);
        if (await users.EmailExistsAsync(email, cancellationToken))
        {
            throw EmailTaken(email);
        }

        await EnsureCodeIsFreeAsync(userCode, null, cancellationToken);
        var user = new User
        {
            UserId = Guid.NewGuid(),
            Email = email,
            UserCode = userCode,
            FullName = input.FullName.Trim(),
            PasswordHash = hasher.Hash(input.Password),
            CreatedAt = clock.UtcNow,
        };
        foreach (var role in roles)
        {
            user.UserRoles.Add(new UserRole { RoleId = Role.IdsByName[role] });
        }

        users.Add(user);
        if (!await users.TrySaveChangesAsync(cancellationToken))
        {
            throw EmailTaken(email);
        }

        return user.ToModel();
    }

    public async Task<UserModel> UpdateAsync(Guid id, UserChanges changes, CancellationToken cancellationToken)
    {
        var user = await RequireAsync(id, cancellationToken);
        var userCode = NormalizeCode(changes.UserCode);
        var roles = NormalizeRoles(changes.Roles, userCode);
        var status = NormalizeStatus(changes.Status);
        if (id == currentUser.UserId && (status == UserStatuses.Locked || !roles.Contains(Roles.Administrator)))
        {
            throw new ConflictException(IdentityErrorCodes.OwnAccessProtected, "You cannot lock your own account or remove your own Administrator role.");
        }

        await EnsureCodeIsFreeAsync(userCode, id, cancellationToken);
        var locking = status == UserStatuses.Locked && user.Status != UserStatuses.Locked;
        user.FullName = changes.FullName.Trim();
        user.UserCode = userCode;
        user.Status = status;
        user.UpdatedAt = clock.UtcNow;
        var wanted = roles.Select(role => Role.IdsByName[role]).ToHashSet();
        foreach (var userRole in user.UserRoles.Where(userRole => !wanted.Contains(userRole.RoleId)).ToList())
        {
            user.UserRoles.Remove(userRole);
        }

        foreach (var roleId in wanted.Where(roleId => user.UserRoles.All(userRole => userRole.RoleId != roleId)))
        {
            user.UserRoles.Add(new UserRole { UserId = user.UserId, RoleId = roleId });
        }

        if (!await users.TrySaveChangesAsync(cancellationToken))
        {
            throw UserCodeTaken(userCode ?? string.Empty);
        }

        if (locking)
        {
            await refreshTokens.RevokeAllAsync(user.UserId, clock.UtcNow, cancellationToken);
        }

        return (await RequireAsync(id, cancellationToken)).ToModel();
    }

    public async Task<IReadOnlyList<ImportedAccount>> ImportStudentsAsync(
        IReadOnlyList<ImportedStudent> students,
        string? defaultPassword,
        CancellationToken cancellationToken)
    {
        if (students.Count == 0)
        {
            throw new ValidationFailedException("students", "Give at least one student.");
        }

        var rows = students
            .Select(student => student with { Email = NormalizeEmail(student.Email), UserCode = NormalizeCode(student.UserCode) ?? string.Empty, FullName = student.FullName.Trim() })
            .ToList();
        EnsureUnique(rows.Select(row => row.Email), "email");
        EnsureUnique(rows.Select(row => row.UserCode), "userCode");

        var existing = (await users.FindByEmailsAsync(rows.Select(row => row.Email).ToList(), cancellationToken))
            .ToDictionary(user => user.Email, StringComparer.OrdinalIgnoreCase);
        var takenCodes = (await users.FindByUserCodesAsync(rows.Select(row => row.UserCode).ToList(), cancellationToken))
            .Where(user => rows.Any(row => row.UserCode == user.UserCode && !string.Equals(row.Email, user.Email, StringComparison.OrdinalIgnoreCase)))
            .Select(user => user.UserCode!)
            .ToList();
        if (takenCodes.Count > 0)
        {
            throw UserCodeTaken(string.Join(", ", takenCodes));
        }

        var defaultHash = new Lazy<string>(() => hasher.Hash(defaultPassword ?? string.Empty));
        var results = new List<ImportedAccount>();
        foreach (var row in rows)
        {
            if (existing.TryGetValue(row.Email, out var user))
            {
                user.FullName = row.FullName;
                user.UserCode = row.UserCode;
                user.UpdatedAt = clock.UtcNow;
                if (user.UserRoles.All(userRole => userRole.RoleId != Role.StudentId))
                {
                    user.UserRoles.Add(new UserRole { UserId = user.UserId, RoleId = Role.StudentId });
                }

                results.Add(new ImportedAccount(row.Email, user.UserId, Created: false));
                continue;
            }

            if (string.IsNullOrEmpty(row.Password) && string.IsNullOrEmpty(defaultPassword))
            {
                throw new ValidationFailedException("defaultPassword", $"New account {row.Email} needs a password or a default password.");
            }

            var created = new User
            {
                UserId = Guid.NewGuid(),
                Email = row.Email,
                UserCode = row.UserCode,
                FullName = row.FullName,
                PasswordHash = string.IsNullOrEmpty(row.Password) ? defaultHash.Value : hasher.Hash(row.Password),
                CreatedAt = clock.UtcNow,
            };
            created.UserRoles.Add(new UserRole { RoleId = Role.StudentId });
            users.Add(created);
            results.Add(new ImportedAccount(row.Email, created.UserId, Created: true));
        }

        if (!await users.TrySaveChangesAsync(cancellationToken))
        {
            throw new ConflictException(IdentityErrorCodes.EmailTaken, "Another import created some of these accounts at the same time. Try again.");
        }

        return results;
    }

    private async Task<User> RequireAsync(Guid id, CancellationToken cancellationToken) =>
        await users.FindAsync(id, cancellationToken) ?? throw new NotFoundException("User", id);

    private async Task EnsureCodeIsFreeAsync(string? userCode, Guid? exceptUserId, CancellationToken cancellationToken)
    {
        if (userCode is not null && await users.UserCodeExistsAsync(userCode, exceptUserId, cancellationToken))
        {
            throw UserCodeTaken(userCode);
        }
    }

    private static List<string> NormalizeRoles(IReadOnlyList<string> roles, string? userCode)
    {
        if (roles.Count == 0)
        {
            throw new ValidationFailedException("roles", "Give at least one role.");
        }

        var names = new List<string>();
        foreach (var role in roles)
        {
            var name = Roles.All.FirstOrDefault(known => string.Equals(known, role?.Trim(), StringComparison.OrdinalIgnoreCase))
                ?? throw new ValidationFailedException("roles", $"'{role}' is not a role. Use {string.Join(", ", Roles.All)}.");
            if (!names.Contains(name))
            {
                names.Add(name);
            }
        }

        if (names.Contains(Roles.Student) && userCode is null)
        {
            throw new ValidationFailedException("userCode", "A student needs a student code.");
        }

        return names;
    }

    private static string NormalizeStatus(string status) =>
        status.Trim() switch
        {
            var value when string.Equals(value, UserStatuses.Active, StringComparison.OrdinalIgnoreCase) => UserStatuses.Active,
            var value when string.Equals(value, UserStatuses.Locked, StringComparison.OrdinalIgnoreCase) => UserStatuses.Locked,
            _ => throw new ValidationFailedException("status", $"Status must be {UserStatuses.Active} or {UserStatuses.Locked}."),
        };

    private static void EnsureUnique(IEnumerable<string> values, string field)
    {
        var duplicate = values.GroupBy(value => value, StringComparer.OrdinalIgnoreCase).FirstOrDefault(group => group.Count() > 1);
        if (duplicate is not null)
        {
            throw new ValidationFailedException(field, $"'{duplicate.Key}' appears more than once.");
        }
    }

    internal static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    private static string? NormalizeCode(string? code) => string.IsNullOrWhiteSpace(code) ? null : code.Trim().ToUpperInvariant();

    private static ConflictException EmailTaken(string email) =>
        new(IdentityErrorCodes.EmailTaken, $"An account with e-mail '{email}' already exists.");

    private static ConflictException UserCodeTaken(string userCode) =>
        new(IdentityErrorCodes.UserCodeTaken, $"Code '{userCode}' already belongs to another account.");
}
