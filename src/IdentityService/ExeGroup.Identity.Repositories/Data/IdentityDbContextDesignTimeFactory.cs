using ExeGroup.BuildingBlocks.Data;

namespace ExeGroup.Identity.Repositories.Data;

public sealed class IdentityDbContextDesignTimeFactory()
    : SqlServerDesignTimeFactory<IdentityDbContext>(DependencyInjection.ConnectionName, options => new IdentityDbContext(options));
