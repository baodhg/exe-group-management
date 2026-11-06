using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;

namespace ExeGroup.Testing;

public sealed class RedisContainer : IAsyncDisposable
{
    private const int RedisPort = 6379;

    private static readonly Lazy<Task<RedisContainer>> SharedContainer = new(StartSharedAsync);

    private readonly IContainer _container = new ContainerBuilder("redis:7-alpine")
        .WithPortBinding(RedisPort, assignRandomHostPort: true)
        .WithWaitStrategy(Wait.ForUnixContainer().UntilCommandIsCompleted("redis-cli", "ping"))
        .Build();

    public string ConnectionString => $"{_container.Hostname}:{_container.GetMappedPublicPort(RedisPort)},abortConnect=false";

    public static Task<RedisContainer> SharedAsync() => SharedContainer.Value;

    public async Task StartAsync(CancellationToken cancellationToken = default) => await _container.StartAsync(cancellationToken);

    public async ValueTask DisposeAsync() => await _container.DisposeAsync();

    private static async Task<RedisContainer> StartSharedAsync()
    {
        var container = new RedisContainer();
        await container.StartAsync();
        return container;
    }
}
