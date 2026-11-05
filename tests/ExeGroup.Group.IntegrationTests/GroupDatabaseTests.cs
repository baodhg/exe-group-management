using ExeGroup.Testing;

namespace ExeGroup.Group.IntegrationTests;

public sealed class GroupDatabaseTests(GroupApiFixture fixture) : IClassFixture<GroupApiFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task The_migrations_build_the_group_database_declared_in_schema_sql()
    {
        var actual = await SchemaSql.ReadAsync(fixture.ConnectionString, Ct);

        Assert.Empty(SchemaSql.Declared("GroupDb").Differences(actual));
    }
}
