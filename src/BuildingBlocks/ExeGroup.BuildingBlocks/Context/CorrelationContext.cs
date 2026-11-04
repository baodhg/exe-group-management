namespace ExeGroup.BuildingBlocks.Context;

public interface ICorrelationContext
{
    string? CorrelationId { get; }

    IDisposable Begin(string? correlationId);
}

public sealed class CorrelationContext : ICorrelationContext
{
    public const string HeaderName = "X-Correlation-ID";
    public const string MetadataKey = "x-correlation-id";

    private static readonly AsyncLocal<string?> Current = new();

    public string? CorrelationId => Current.Value;

    public IDisposable Begin(string? correlationId)
    {
        var previous = Current.Value;
        Current.Value = string.IsNullOrWhiteSpace(correlationId) ? NewId() : correlationId.Trim();
        return new Scope(previous);
    }

    public static string NewId() => Guid.NewGuid().ToString("N");

    private sealed class Scope(string? previous) : IDisposable
    {
        public void Dispose() => Current.Value = previous;
    }
}
