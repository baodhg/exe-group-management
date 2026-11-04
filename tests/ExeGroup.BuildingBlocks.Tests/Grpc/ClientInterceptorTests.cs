using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Grpc;
using Grpc.Core;
using Grpc.Core.Interceptors;

namespace ExeGroup.BuildingBlocks.Tests.Grpc;

public sealed class ClientInterceptorTests
{
    private static readonly Method<string, string> Probe = new(
        MethodType.Unary,
        "exegroup.v1.Probe",
        "Call",
        Marshallers.Create(value => System.Text.Encoding.UTF8.GetBytes(value), bytes => System.Text.Encoding.UTF8.GetString(bytes)),
        Marshallers.Create(value => System.Text.Encoding.UTF8.GetBytes(value), bytes => System.Text.Encoding.UTF8.GetString(bytes)));

    [Fact]
    public void Correlation_id_of_the_current_flow_is_sent_as_metadata()
    {
        var correlation = new CorrelationContext();
        using var scope = correlation.Begin("flow-42");

        var sent = Capture(new CorrelationClientInterceptor(correlation), new CallOptions());

        Assert.Equal("flow-42", sent.Headers?.GetValue(CorrelationContext.MetadataKey));
    }

    [Fact]
    public void Existing_correlation_metadata_is_not_overwritten()
    {
        var correlation = new CorrelationContext();
        using var scope = correlation.Begin("flow-42");
        var headers = new Metadata { { CorrelationContext.MetadataKey, "caller-chosen" } };

        var sent = Capture(new CorrelationClientInterceptor(correlation), new CallOptions(headers));

        Assert.Equal("caller-chosen", sent.Headers?.GetValue(CorrelationContext.MetadataKey));
        Assert.Single(sent.Headers!, entry => entry.Key == CorrelationContext.MetadataKey);
    }

    [Fact]
    public void The_callers_metadata_object_is_left_untouched()
    {
        var correlation = new CorrelationContext();
        using var scope = correlation.Begin("flow-7");
        var shared = new Metadata { { "x-tenant", "fptu" } };

        var sent = Capture(new CorrelationClientInterceptor(correlation), new CallOptions(shared));

        Assert.Single(shared);
        Assert.Equal("fptu", sent.Headers?.GetValue("x-tenant"));
        Assert.Equal("flow-7", sent.Headers?.GetValue(CorrelationContext.MetadataKey));
    }

    [Fact]
    public void Calls_without_a_deadline_get_the_default_one()
    {
        var before = DateTime.UtcNow;

        var sent = Capture(new DefaultDeadlineClientInterceptor(TimeSpan.FromSeconds(5)), new CallOptions());

        Assert.NotNull(sent.Deadline);
        Assert.InRange(sent.Deadline!.Value, before.AddSeconds(4.5), DateTime.UtcNow.AddSeconds(5.5));
    }

    [Fact]
    public void An_explicit_deadline_is_kept()
    {
        var explicitDeadline = DateTime.UtcNow.AddSeconds(30);

        var sent = Capture(new DefaultDeadlineClientInterceptor(TimeSpan.FromSeconds(5)), new CallOptions(deadline: explicitDeadline));

        Assert.Equal(explicitDeadline, sent.Deadline);
    }

    private static CallOptions Capture(Interceptor interceptor, CallOptions options)
    {
        CallOptions? captured = null;
        var context = new ClientInterceptorContext<string, string>(Probe, host: null, options);

        interceptor.BlockingUnaryCall("ping", context, (request, next) =>
        {
            captured = next.Options;
            return "pong";
        });

        return captured ?? throw new InvalidOperationException("The interceptor did not call the continuation.");
    }
}
