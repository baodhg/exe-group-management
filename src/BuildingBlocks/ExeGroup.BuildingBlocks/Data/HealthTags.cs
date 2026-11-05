namespace ExeGroup.BuildingBlocks.Data;

public static class HealthTags
{
    public const string Ready = "ready";

    public static readonly TimeSpan CheckTimeout = TimeSpan.FromSeconds(5);
}
