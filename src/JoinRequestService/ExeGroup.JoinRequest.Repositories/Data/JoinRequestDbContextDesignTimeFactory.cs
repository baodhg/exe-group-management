using ExeGroup.BuildingBlocks.Data;

namespace ExeGroup.JoinRequest.Repositories.Data;

public sealed class JoinRequestDbContextDesignTimeFactory()
    : SqlServerDesignTimeFactory<JoinRequestDbContext>(DependencyInjection.ConnectionName, options => new JoinRequestDbContext(options));
