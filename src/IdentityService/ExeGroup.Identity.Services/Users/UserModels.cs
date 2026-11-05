using ExeGroup.Identity.Repositories.Entities;

namespace ExeGroup.Identity.Services.Users;

public sealed record UserModel(
    Guid Id,
    string Email,
    string? UserCode,
    string FullName,
    string Status,
    IReadOnlyList<string> Roles,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record NewUser(string Email, string FullName, string? UserCode, string Password, IReadOnlyList<string> Roles);

public sealed record UserChanges(string FullName, string? UserCode, string Status, IReadOnlyList<string> Roles);

public sealed record ImportedStudent(string Email, string FullName, string UserCode, string? Password);

public sealed record ImportedAccount(string Email, Guid UserId, bool Created);

public static class UserModelMapping
{
    public static UserModel ToModel(this User user) =>
        new(
            user.UserId,
            user.Email,
            user.UserCode,
            user.FullName,
            user.Status,
            user.UserRoles.Select(userRole => userRole.Role?.Name ?? NameOf(userRole.RoleId)).Order(StringComparer.Ordinal).ToList(),
            user.CreatedAt,
            user.UpdatedAt);

    private static string NameOf(Guid roleId) =>
        Role.IdsByName.Single(pair => pair.Value == roleId).Key;
}
