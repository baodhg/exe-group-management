using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Identity.Repositories.Data;
using ExeGroup.Identity.Repositories.Entities;
using ExeGroup.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.Identity.IntegrationTests;

public sealed class IdentityDatabaseTests(IdentityApiFixture fixture) : IClassFixture<IdentityApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task The_migrations_build_the_identity_database_declared_in_schema_sql()
    {
        var actual = await SchemaSql.ReadAsync(fixture.ConnectionString, Ct);

        Assert.Empty(SchemaSql.Declared("IdentityDb").Differences(actual));
    }

    [Fact]
    public async Task The_three_roles_are_seeded_with_their_fixed_ids()
    {
        await using var scope = fixture.Api.Services.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();

        var roles = await database.Roles.OrderBy(role => role.Name).Select(role => new { role.RoleId, role.Name }).ToListAsync(Ct);

        var expected = new[]
        {
            new { RoleId = Role.AdministratorId, Name = Roles.Administrator },
            new { RoleId = Role.LecturerId, Name = Roles.Lecturer },
            new { RoleId = Role.StudentId, Name = Roles.Student },
        };
        Assert.Equal(expected, roles);
    }

    [Fact]
    public async Task Removing_a_user_removes_their_roles_and_refresh_tokens()
    {
        var userId = Guid.NewGuid();
        await using (var scope = fixture.Api.Services.CreateAsyncScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
            database.Users.Add(new User { UserId = userId, Email = $"{userId:N}@fpt.edu.vn", PasswordHash = "hash", FullName = "Test User" });
            database.UserRoles.Add(new UserRole { UserId = userId, RoleId = Role.StudentId });
            database.RefreshTokens.Add(new RefreshToken { RefreshTokenId = Guid.NewGuid(), UserId = userId, TokenHash = new string('a', 64), ExpiresAt = DateTime.UtcNow.AddDays(7) });
            await database.SaveChangesAsync(Ct);
        }

        await using (var scope = fixture.Api.Services.CreateAsyncScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
            var user = await database.Users.SingleAsync(candidate => candidate.UserId == userId, Ct);
            Assert.Equal(UserStatuses.Active, user.Status);
            Assert.NotEqual(default, user.CreatedAt);

            await database.Users.Where(candidate => candidate.UserId == userId).ExecuteDeleteAsync(Ct);

            Assert.False(await database.UserRoles.AnyAsync(userRole => userRole.UserId == userId, Ct));
            Assert.False(await database.RefreshTokens.AnyAsync(token => token.UserId == userId, Ct));
        }
    }
}
