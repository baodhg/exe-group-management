namespace ExeGroup.Group.Repositories.Entities;

public sealed class Room
{
    public Guid RoomId { get; set; }

    public Guid CourseId { get; set; }

    public Guid SemesterId { get; set; }

    public Guid GroupTypeId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Topic { get; set; }

    public int Capacity { get; set; }

    public string Status { get; set; } = RoomStatuses.Open;

    public Guid? LeaderId { get; set; }

    public int MemberCount { get; set; }

    public int? GroupNo { get; set; }

    public DateTime? LockedAt { get; set; }

    public byte[] RowVersion { get; set; } = [];

    public ICollection<RoomMember> Members { get; } = [];
}

public static class RoomStatuses
{
    public const string Open = "Open";
    public const string Locked = "Locked";
    public const string Finalized = "Finalized";
}
