using ExeGroup.Testing;

namespace ExeGroup.Realtime.IntegrationTests;

public sealed class ChatDatabaseTests(RealtimeApiFixture fixture) : IClassFixture<RealtimeApiFixture>
{
    [Fact]
    public async Task The_migrations_build_the_chat_database_declared_in_schema_sql()
    {
        var actual = await SchemaSql.ReadAsync(fixture.ConnectionString, TestContext.Current.CancellationToken);

        Assert.Empty(SchemaSql.Declared("ChatDb").Differences(actual));
    }
}
