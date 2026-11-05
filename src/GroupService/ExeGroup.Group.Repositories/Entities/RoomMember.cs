namespace ExeGroup.Group.Repositories.Entities;

public sealed class RoomMember
{
    public Guid MembershipId { get; set; }

    public Guid RoomId { get; set; }

    public Guid CourseId { get; set; }

    public Guid StudentId { get; set; }

    public string JoinedVia { get; set; } = JoinMethods.Open;

    public DateTime JoinedAt { get; set; }

    public DateTime? EndedAt { get; set; }

    public string? EndReason { get; set; }

    public Guid? EndedBy { get; set; }

    public string? EndNote { get; set; }
}

public static class JoinMethods
{
    public const string Open = "Open";
    public const string Application = "Application";
    public const string Admin = "Admin";
}

public static class MembershipEndReasons
{
    public const string Left = "Left";
    public const string Removed = "Removed";
    public const string Moved = "Moved";
}
