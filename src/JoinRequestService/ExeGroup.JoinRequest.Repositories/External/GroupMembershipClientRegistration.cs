using ExeGroup.BuildingBlocks.Grpc;
using ExeGroup.Contracts.Grpc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.JoinRequest.Repositories.External;

public static class GroupMembershipClientRegistration
{
    public const string AddressKey = "GrpcClients:GroupService";
    public const string DeadlineKey = "GrpcClients:DeadlineSeconds";

    public static IServiceCollection AddGroupMembershipClient(this IServiceCollection services, IConfiguration configuration)
    {
        var address = configuration[AddressKey];
        if (string.IsNullOrWhiteSpace(address))
        {
            throw new InvalidOperationException($"{AddressKey} is missing. Set GrpcClients__GroupService.");
        }

        var deadline = TimeSpan.FromSeconds(configuration.GetValue(DeadlineKey, 5));
        services.AddSingleton(new DefaultDeadlineClientInterceptor(deadline));
        services.AddSingleton<CorrelationClientInterceptor>();
        services.AddGrpcClient<GroupMembership.GroupMembershipClient>(options => options.Address = new Uri(address))
            .AddInterceptor<CorrelationClientInterceptor>()
            .AddInterceptor<DefaultDeadlineClientInterceptor>();
        return services;
    }
}
