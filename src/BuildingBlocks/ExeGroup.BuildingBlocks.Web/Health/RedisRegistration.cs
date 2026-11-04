using ExeGroup.BuildingBlocks.Data;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using StackExchange.Redis;

namespace ExeGroup.BuildingBlocks.Web.Health;

public static class RedisRegistration
{
    public const string ConfigurationKey = "Redis:Connection";

    public static IServiceCollection AddRedis(this IServiceCollection services, IConfiguration configuration)
    {
        var connection = configuration[ConfigurationKey];
        if (string.IsNullOrWhiteSpace(connection))
        {
            throw new InvalidOperationException($"{ConfigurationKey} is missing. Set Redis__Connection.");
        }

        var options = ConfigurationOptions.Parse(connection);
        options.AbortOnConnectFail = false;
        options.ConnectTimeout = 3000;
        services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(options));
        services.AddHealthChecks().AddCheck<RedisHealthCheck>("redis", HealthStatus.Unhealthy, [HealthTags.Ready], HealthTags.CheckTimeout);
        return services;
    }
}

public sealed class RedisHealthCheck(IConnectionMultiplexer redis) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            var latency = await redis.GetDatabase().PingAsync().WaitAsync(cancellationToken);
            return HealthCheckResult.Healthy($"PING {latency.TotalMilliseconds:0.0} ms");
        }
        catch (Exception exception) when (exception is RedisException or TimeoutException or OperationCanceledException)
        {
            return HealthCheckResult.Unhealthy("Redis did not answer PING.", exception);
        }
    }
}
