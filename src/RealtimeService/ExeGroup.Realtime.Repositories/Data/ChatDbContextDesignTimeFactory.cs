using ExeGroup.BuildingBlocks.Data;

namespace ExeGroup.Realtime.Repositories.Data;

public sealed class ChatDbContextDesignTimeFactory()
    : SqlServerDesignTimeFactory<ChatDbContext>(DependencyInjection.ConnectionName, options => new ChatDbContext(options));
