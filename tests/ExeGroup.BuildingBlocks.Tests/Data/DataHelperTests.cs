using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Paging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.BuildingBlocks.Tests.Data;

[Collection(SqlServerCollection.Name)]
public sealed class DataHelperTests(SqlServerFixture sql)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task A_failure_inside_the_transaction_leaves_no_rows_behind()
    {
        await using var context = await sql.NewDatabaseAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() => context.ExecuteInTransactionAsync(async token =>
        {
            context.Groups.Add(new ProbeGroup { Code = "A" });
            await context.SaveChangesAsync(token);
            context.Groups.Add(new ProbeGroup { Code = "B" });
            await context.SaveChangesAsync(token);
            throw new InvalidOperationException("business rule failed after both writes");
        }, Ct));

        context.ChangeTracker.Clear();
        Assert.Equal(0, await context.Groups.CountAsync(Ct));
    }

    [Fact]
    public async Task A_transient_failure_is_retried_without_applying_the_first_attempt_twice()
    {
        await using var context = await sql.NewDatabaseAsync();
        var group = new ProbeGroup { Code = "G1", Members = 0 };
        context.Groups.Add(group);
        await context.SaveChangesAsync(Ct);
        context.ChangeTracker.Clear();
        var attempts = 0;

        await context.ExecuteInTransactionAsync(async token =>
        {
            attempts++;
            var tracked = await context.Groups.SingleAsync(row => row.Id == group.Id, token);
            tracked.Members += 1;
            context.Members.Add(new ProbeMember { Id = Guid.NewGuid(), GroupId = group.Id });
            await context.SaveChangesAsync(token);
            if (attempts == 1)
            {
                throw new TimeoutException("simulated network blip after the writes");
            }
        }, Ct);

        context.ChangeTracker.Clear();
        Assert.Equal(2, attempts);
        Assert.Equal(1, (await context.Groups.SingleAsync(row => row.Id == group.Id, Ct)).Members);
        Assert.Equal(1, await context.Members.CountAsync(Ct));
    }

    [Fact]
    public async Task Pending_changes_made_before_the_transaction_are_refused_instead_of_silently_dropped()
    {
        await using var context = await sql.NewDatabaseAsync();
        var group = new ProbeGroup { Code = "PRE", Members = 0 };
        context.Groups.Add(group);
        await context.SaveChangesAsync(Ct);
        group.Members = 5;

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => context.ExecuteInTransactionAsync(async token =>
        {
            context.Members.Add(new ProbeMember { Id = Guid.NewGuid(), GroupId = group.Id });
            await context.SaveChangesAsync(token);
        }, Ct));

        context.ChangeTracker.Clear();
        Assert.Contains("inside the transaction", error.Message);
        Assert.Equal(0, await context.Members.CountAsync(Ct));
    }

    [Fact]
    public async Task Entities_loaded_before_the_transaction_cannot_be_modified_inside_it_by_accident()
    {
        await using var context = await sql.NewDatabaseAsync();
        context.Groups.Add(new ProbeGroup { Code = "OUT", Members = 0 });
        await context.SaveChangesAsync(Ct);
        context.ChangeTracker.Clear();
        var loadedOutside = await context.Groups.SingleAsync(Ct);

        await Assert.ThrowsAsync<InvalidOperationException>(() => context.ExecuteInTransactionAsync(async token =>
        {
            loadedOutside.Members = 7;
            await context.SaveChangesAsync(token);
        }, Ct));
    }

    [Fact]
    public async Task Duplicate_unique_values_are_recognised_and_other_failures_are_not()
    {
        await using var context = await sql.NewDatabaseAsync();
        context.Groups.Add(new ProbeGroup { Code = "SAME" });
        await context.SaveChangesAsync(Ct);

        context.Groups.Add(new ProbeGroup { Code = "SAME" });
        var duplicate = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync(Ct));
        context.ChangeTracker.Clear();

        context.Members.Add(new ProbeMember { Id = Guid.NewGuid(), GroupId = Guid.NewGuid() });
        var missingParent = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync(Ct));

        Assert.True(duplicate.IsUniqueViolation());
        Assert.False(missingParent.IsUniqueViolation());
    }

    [Fact]
    public async Task Saving_a_duplicate_reports_false_and_other_failures_still_throw()
    {
        await using var context = await sql.NewDatabaseAsync();
        context.Groups.Add(new ProbeGroup { Code = "SAME" });
        Assert.True(await context.TrySaveChangesAsync(Ct));

        context.Groups.Add(new ProbeGroup { Code = "SAME" });
        Assert.False(await context.TrySaveChangesAsync(Ct));
        context.ChangeTracker.Clear();

        context.Members.Add(new ProbeMember { Id = Guid.NewGuid(), GroupId = Guid.NewGuid() });
        await Assert.ThrowsAsync<DbUpdateException>(() => context.TrySaveChangesAsync(Ct));
    }

    [Fact]
    public async Task The_registered_transaction_runner_covers_repositories_of_the_same_scope()
    {
        await using var database = await sql.NewDatabaseAsync();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:Probe"] = database.Database.GetConnectionString() })
            .Build();
        await using var provider = new ServiceCollection()
            .AddLogging()
            .AddSqlServerDatabase<ProbeDbContext>(configuration, "Probe")
            .BuildServiceProvider();
        await using var scope = provider.CreateAsyncScope();
        var runner = scope.ServiceProvider.GetRequiredService<ITransactionRunner>();
        var context = scope.ServiceProvider.GetRequiredService<ProbeDbContext>();

        await Assert.ThrowsAsync<InvalidOperationException>(() => runner.ExecuteAsync(async token =>
        {
            context.Groups.Add(new ProbeGroup { Code = "ROLLED-BACK" });
            await context.SaveChangesAsync(token);
            throw new InvalidOperationException("business rule failed after the write");
        }, Ct));

        context.ChangeTracker.Clear();
        var saved = await runner.ExecuteAsync(async token =>
        {
            context.Groups.Add(new ProbeGroup { Code = "COMMITTED" });
            return await context.SaveChangesAsync(token);
        }, Ct);

        Assert.Equal(1, saved);
        Assert.Equal(["COMMITTED"], await context.Groups.AsNoTracking().Select(group => group.Code).ToListAsync(Ct));
    }

    [Fact]
    public async Task Paging_and_multi_field_sorting_run_in_sql_with_a_stable_order()
    {
        await using var context = await sql.NewDatabaseAsync();
        context.Groups.AddRange(Enumerable.Range(1, 25).Select(i => new ProbeGroup { Code = $"C{i:00}", Members = i % 3 }));
        await context.SaveChangesAsync(Ct);
        var map = new SortMap<ProbeGroup>()
            .Add("code", group => group.Code)
            .Add("members", group => group.Members)
            .ByDefault("code")
            .TieBreaker(group => group.Id);

        var page = await context.Groups.AsNoTracking()
            .ToPagedResultAsync(ListQuery.Create(null, "-members,code", 2, 10), map, Ct);
        var firstByDefault = await context.Groups.AsNoTracking()
            .ToPagedResultAsync(ListQuery.Create(null, null, 1, 3), map, Ct);

        Assert.Equal(25, page.TotalItems);
        Assert.Equal(3, page.TotalPages);
        Assert.Equal(10, page.Items.Count);
        Assert.Equal(["C07", "C10", "C13", "C16", "C19", "C22", "C25", "C03", "C06", "C09"], page.Items.Select(group => group.Code));
        Assert.Equal(["C01", "C02", "C03"], firstByDefault.Items.Select(group => group.Code));
    }

    [Fact]
    public async Task Paging_without_a_default_sort_and_tie_breaker_is_a_programming_error()
    {
        await using var context = await sql.NewDatabaseAsync();
        var noDefault = new SortMap<ProbeGroup>().Add("code", group => group.Code).TieBreaker(group => group.Id);
        var noTieBreaker = new SortMap<ProbeGroup>().Add("code", group => group.Code).ByDefault("code");

        await Assert.ThrowsAsync<InvalidOperationException>(() => context.Groups.ToPagedResultAsync(ListQuery.Default, noDefault, Ct));
        await Assert.ThrowsAsync<InvalidOperationException>(() => context.Groups.ToPagedResultAsync(ListQuery.Default, noTieBreaker, Ct));
    }
}
