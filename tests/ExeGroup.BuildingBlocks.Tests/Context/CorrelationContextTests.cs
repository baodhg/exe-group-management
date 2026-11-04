using ExeGroup.BuildingBlocks.Context;

namespace ExeGroup.BuildingBlocks.Tests.Context;

public sealed class CorrelationContextTests
{
    [Fact]
    public async Task A_correlation_scope_flows_into_awaited_work_and_ends_on_dispose()
    {
        var context = new CorrelationContext();

        using (context.Begin("abc-123"))
        {
            await Task.Yield();
            Assert.Equal("abc-123", context.CorrelationId);
        }

        Assert.Null(context.CorrelationId);
    }

    [Fact]
    public async Task Parallel_flows_keep_their_own_correlation_id()
    {
        var context = new CorrelationContext();

        async Task<string?> Run(string id)
        {
            using var scope = context.Begin(id);
            await Task.Delay(10);
            return context.CorrelationId;
        }

        var results = await Task.WhenAll(Run("first"), Run("second"));

        Assert.Equal(["first", "second"], results);
    }

    [Fact]
    public void Blank_ids_are_replaced_by_a_generated_one()
    {
        var context = new CorrelationContext();

        using var scope = context.Begin("  ");

        Assert.False(string.IsNullOrWhiteSpace(context.CorrelationId));
        Assert.Equal(32, context.CorrelationId!.Length);
    }
}
