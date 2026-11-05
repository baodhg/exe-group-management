using ExeGroup.BuildingBlocks.Context;
using Serilog.Context;

namespace ExeGroup.BuildingBlocks.Web.Observability;

public static class CorrelationScope
{
    public const string LogProperty = "CorrelationId";

    public static IDisposable Begin(ICorrelationContext correlation, string correlationId)
    {
        var flow = correlation.Begin(correlationId);
        var log = LogContext.PushProperty(LogProperty, correlation.CorrelationId);
        return new Both(log, flow);
    }

    private sealed class Both(IDisposable inner, IDisposable outer) : IDisposable
    {
        public void Dispose()
        {
            inner.Dispose();
            outer.Dispose();
        }
    }
}
