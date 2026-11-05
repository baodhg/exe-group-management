using ExeGroup.BuildingBlocks.Data;

namespace ExeGroup.Group.Repositories.Data;

public sealed class GroupDbContextDesignTimeFactory()
    : SqlServerDesignTimeFactory<GroupDbContext>(DependencyInjection.ConnectionName, options => new GroupDbContext(options));
