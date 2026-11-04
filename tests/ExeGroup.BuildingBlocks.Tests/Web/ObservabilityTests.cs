using System.Collections.Concurrent;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Hosting;
using ExeGroup.BuildingBlocks.Web.Observability;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace ExeGroup.BuildingBlocks.Tests.Web;

public sealed class ObservabilityTests : IAsyncLifetime
{
    private readonly CapturingLoggerProvider _logs = new();
    private WebApplication _app = null!;
    private HttpClient _client = null!;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Logging.ClearProviders().AddProvider(_logs);
        builder.Services.AddApiDefaults(typeof(EnvelopeHost).Assembly);
        builder.Services.AddCorrelation();

        _app = builder.Build();
        _app.UseCorrelationAndRequestLogging();
        _app.UseApiDefaults();
        _app.MapGet("/echo", (ICorrelationContext correlation, HttpContext http) => Results.Ok(new
        {
            seen = correlation.CorrelationId,
            forwarded = http.Request.Headers[CorrelationContext.HeaderName].ToString(),
        }));
        _app.MapControllers();
        await _app.StartAsync();
        _client = _app.GetTestClient();
    }

    public async ValueTask DisposeAsync() => await _app.DisposeAsync();

    [Fact]
    public async Task A_request_without_correlation_id_gets_one_in_response_and_request()
    {
        var response = await _client.GetAsync("/echo", Ct);
        var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement;

        var issued = Assert.Single(response.Headers.GetValues(CorrelationContext.HeaderName));
        Assert.Equal(32, issued.Length);
        Assert.Equal(issued, body.GetProperty("seen").GetString());
        Assert.Equal(issued, body.GetProperty("forwarded").GetString());
    }

    [Fact]
    public async Task A_valid_incoming_correlation_id_is_kept_end_to_end()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/probe/conflict");
        request.Headers.Add(CorrelationContext.HeaderName, "demo-approve-001");

        var response = await _client.SendAsync(request, Ct);
        var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement;

        Assert.Equal("demo-approve-001", Assert.Single(response.Headers.GetValues(CorrelationContext.HeaderName)));
        Assert.Equal("demo-approve-001", body.GetProperty("traceId").GetString());
    }

    [Theory]
    [InlineData("bad id with spaces")]
    [InlineData("<script>/../")]
    [InlineData("0123456789012345678901234567890123456789012345678901234567890123456789")]
    public async Task Unsafe_incoming_ids_are_replaced(string incoming)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/echo");
        request.Headers.TryAddWithoutValidation(CorrelationContext.HeaderName, incoming);

        var response = await _client.SendAsync(request, Ct);

        var issued = Assert.Single(response.Headers.GetValues(CorrelationContext.HeaderName));
        Assert.NotEqual(incoming, issued);
        Assert.Equal(32, issued.Length);
    }

    [Fact]
    public async Task Every_request_is_logged_with_method_path_status_and_duration()
    {
        await _client.GetAsync("/probe/conflict", Ct);

        var entry = Assert.Single(_logs.Entries, line => line.Contains("/probe/conflict"));
        Assert.Contains("GET", entry);
        Assert.Contains("409", entry);
        Assert.Matches(@"\d+(\.\d+)? ms", entry);
    }

    private sealed class CapturingLoggerProvider : ILoggerProvider
    {
        public ConcurrentQueue<string> Entries { get; } = new();

        public ILogger CreateLogger(string categoryName) =>
            categoryName == typeof(RequestLoggingMiddleware).FullName ? new Logger(Entries) : Microsoft.Extensions.Logging.Abstractions.NullLogger.Instance;

        public void Dispose()
        {
        }

        private sealed class Logger(ConcurrentQueue<string> entries) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state)
                where TState : notnull => null;

            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
                entries.Enqueue(formatter(state, exception));
        }
    }
}
