using System.Net;
using System.Net.Sockets;

namespace ExeGroup.ApiGateway;

public sealed class ClientAddressResolver(IConfiguration configuration, ILogger<ClientAddressResolver> logger)
{
    private const string ForwardedForHeader = "X-Forwarded-For";
    private const string UnknownClient = "unknown";
    private static readonly TimeSpan LookupLifetime = TimeSpan.FromSeconds(30);

    private readonly string? _trustedProxyHost = configuration["Gateway:TrustedProxyHost"];
    private volatile ProxyLookup _lookup = new([], DateTimeOffset.MinValue);

    public string Resolve(HttpContext context)
    {
        var peer = Canonical(context.Connection.RemoteIpAddress);
        if (peer is null)
        {
            return UnknownClient;
        }

        if (!TrustedProxyAddresses().Contains(peer))
        {
            return peer.ToString();
        }

        var addedByProxy = context.Request.Headers[ForwardedForHeader].ToString().Split(',')[^1].Trim();
        return IPAddress.TryParse(addedByProxy, out var client) ? Canonical(client)!.ToString() : peer.ToString();
    }

    private IPAddress[] TrustedProxyAddresses()
    {
        if (string.IsNullOrWhiteSpace(_trustedProxyHost))
        {
            return [];
        }

        var lookup = _lookup;
        if (DateTimeOffset.UtcNow < lookup.ExpiresAt)
        {
            return lookup.Addresses;
        }

        var addresses = lookup.Addresses;
        try
        {
            addresses = Dns.GetHostAddresses(_trustedProxyHost).Select(address => Canonical(address)!).ToArray();
        }
        catch (SocketException exception)
        {
            logger.LogWarning(exception, "Could not resolve the trusted proxy host {Host}", _trustedProxyHost);
        }

        _lookup = new ProxyLookup(addresses, DateTimeOffset.UtcNow + LookupLifetime);
        return addresses;
    }

    private static IPAddress? Canonical(IPAddress? address) =>
        address is { IsIPv4MappedToIPv6: true } ? address.MapToIPv4() : address;

    private sealed record ProxyLookup(IPAddress[] Addresses, DateTimeOffset ExpiresAt);
}
