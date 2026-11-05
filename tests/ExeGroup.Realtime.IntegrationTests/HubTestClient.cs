using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading.Channels;
using ExeGroup.Realtime.API.Hubs;
using Microsoft.AspNetCore.TestHost;

namespace ExeGroup.Realtime.IntegrationTests;

public sealed class HubTestClient : IAsyncDisposable
{
    private const char RecordSeparator = '\u001e';
    private readonly WebSocket _socket;
    private readonly Channel<JsonElement> _pushed = Channel.CreateUnbounded<JsonElement>();
    private readonly ConcurrentDictionary<string, TaskCompletionSource<JsonElement>> _pending = new();
    private readonly CancellationTokenSource _closing = new();
    private readonly Task _reader;
    private int _nextInvocation;

    private HubTestClient(WebSocket socket)
    {
        _socket = socket;
        _reader = Task.Run(ReadAsync);
    }

    public static async Task<HubTestClient> ConnectAsync(TestServer server, string? accessToken, CancellationToken cancellationToken)
    {
        var query = accessToken is null ? string.Empty : $"?{RealtimeUser.AccessTokenQuery}={Uri.EscapeDataString(accessToken)}";
        var socket = await server.CreateWebSocketClient().ConnectAsync(new Uri($"ws://localhost{RealtimeHub.Route}{query}"), cancellationToken);
        await SendAsync(socket, """{"protocol":"json","version":1}""", cancellationToken);
        var handshake = await ReceiveRecordAsync(socket, cancellationToken);
        if (handshake.TryGetProperty("error", out var error))
        {
            throw new InvalidOperationException($"Handshake failed: {error.GetString()}");
        }

        var client = new HubTestClient(socket);
        await client.InvokeAsync("unwatchCourse", Guid.Empty);
        return client;
    }

    public async Task<JsonElement> InvokeAsync(string method, params object?[] arguments)
    {
        var id = Interlocked.Increment(ref _nextInvocation).ToString(System.Globalization.CultureInfo.InvariantCulture);
        var completion = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        _pending[id] = completion;
        await SendAsync(_socket, JsonSerializer.Serialize(new { type = 1, invocationId = id, target = method, arguments }), _closing.Token);
        var result = await completion.Task.WaitAsync(TimeSpan.FromSeconds(10));
        return result.TryGetProperty("error", out var error) ? throw new HubCallException(error.GetString() ?? string.Empty) : result.TryGetProperty("result", out var value) ? value : default;
    }

    public async Task<JsonElement> NextAsync(string target, TimeSpan? timeout = null)
    {
        using var limit = new CancellationTokenSource(timeout ?? TimeSpan.FromSeconds(5));
        while (true)
        {
            var message = await _pushed.Reader.ReadAsync(limit.Token);
            if (message.GetProperty("target").GetString() == target)
            {
                return message.GetProperty("arguments")[0];
            }
        }
    }

    public async Task<bool> ReceivesAsync(string target, TimeSpan wait)
    {
        try
        {
            await NextAsync(target, wait);
            return true;
        }
        catch (OperationCanceledException)
        {
            return false;
        }
    }

    public async ValueTask DisposeAsync()
    {
        try
        {
            if (_socket.State == WebSocketState.Open)
            {
                await _socket.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None);
            }
        }
        catch (Exception exception) when (exception is ObjectDisposedException or WebSocketException)
        {
        }

        await _closing.CancelAsync();
        try
        {
            await _reader;
        }
        catch (Exception exception) when (exception is OperationCanceledException or WebSocketException or ObjectDisposedException)
        {
        }

        _socket.Dispose();
        _closing.Dispose();
    }

    private static Task SendAsync(WebSocket socket, string json, CancellationToken cancellationToken) =>
        socket.SendAsync(Encoding.UTF8.GetBytes(json + RecordSeparator), WebSocketMessageType.Text, true, cancellationToken);

    private static async Task<JsonElement> ReceiveRecordAsync(WebSocket socket, CancellationToken cancellationToken)
    {
        var text = new StringBuilder();
        var buffer = new byte[4096];
        while (!text.ToString().Contains(RecordSeparator))
        {
            var received = await socket.ReceiveAsync(buffer, cancellationToken);
            text.Append(Encoding.UTF8.GetString(buffer, 0, received.Count));
        }

        return JsonDocument.Parse(text.ToString().TrimEnd(RecordSeparator)).RootElement.Clone();
    }

    private async Task ReadAsync()
    {
        var text = new StringBuilder();
        var buffer = new byte[8192];
        while (!_closing.IsCancellationRequested && _socket.State == WebSocketState.Open)
        {
            var received = await _socket.ReceiveAsync(buffer, _closing.Token);
            if (received.MessageType == WebSocketMessageType.Close)
            {
                return;
            }

            text.Append(Encoding.UTF8.GetString(buffer, 0, received.Count));
            var records = text.ToString().Split(RecordSeparator);
            text.Clear().Append(records[^1]);
            foreach (var record in records[..^1].Where(record => record.Length > 0))
            {
                Dispatch(JsonDocument.Parse(record).RootElement.Clone());
            }
        }
    }

    private void Dispatch(JsonElement message)
    {
        switch (message.GetProperty("type").GetInt32())
        {
            case 1:
                _pushed.Writer.TryWrite(message);
                break;
            case 3 when _pending.TryRemove(message.GetProperty("invocationId").GetString()!, out var completion):
                completion.TrySetResult(message);
                break;
        }
    }
}

public sealed class HubCallException(string message) : Exception(message);
