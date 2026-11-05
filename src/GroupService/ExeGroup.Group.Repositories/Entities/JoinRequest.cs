namespace ExeGroup.Group.Repositories.Entities;

public sealed class JoinRequest
{
    public Guid RequestId { get; set; }

    public Guid RoomId { get; set; }

    public Guid CourseId { get; set; }

    public Guid StudentId { get; set; }

    public string? Message { get; set; }

    public string Status { get; set; } = JoinRequestStatuses.Pending;

    public Guid? DecidedBy { get; set; }

    public DateTime? DecidedAt { get; set; }

    public string? ReasonCode { get; set; }

    public string? ReasonText { get; set; }

    public DateTime CreatedAt { get; set; }

    public byte[] RowVersion { get; set; } = [];
}

public static class JoinRequestStatuses
{
    public const string Pending = "Pending";
    public const string Approved = "Approved";
    public const string Rejected = "Rejected";
    public const string Cancelled = "Cancelled";
}

public static class JoinRequestReasons
{
    public const string RejectedByLeader = "REJECTED_BY_LEADER";
    public const string Withdrawn = "WITHDRAWN";
    public const string RoomFull = "ROOM_FULL";
    public const string RoomReopened = "ROOM_REOPENED";
    public const string CompositionRule = "COMPOSITION_RULE";
    public const string JoinedAnotherRoom = "JOINED_ANOTHER_ROOM";
    public const string GroupingExpired = "GROUPING_EXPIRED";
}
