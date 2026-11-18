namespace ExeGroup.Group.Repositories.Entities;

public sealed class ProjectMilestone
{
    public Guid MilestoneId { get; set; }

    public Guid CourseId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public int Sequence { get; set; }

    public DateTime? DueAt { get; set; }

    public int Weight { get; set; } = 1;

    public DateTime CreatedAt { get; set; }

    public byte[] RowVersion { get; set; } = [];
}

public sealed class ProjectDeliverable
{
    public Guid DeliverableId { get; set; }

    public Guid MilestoneId { get; set; }

    public Guid CourseId { get; set; }

    public Guid RoomId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Notes { get; set; }

    public string Status { get; set; } = DeliverableStatuses.NotStarted;

    public Guid? SubmittedBy { get; set; }

    public DateTime? SubmittedAt { get; set; }

    public Guid? ReviewedBy { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public decimal? Score { get; set; }

    public string? ReviewNote { get; set; }

    public DateTime CreatedAt { get; set; }

    public byte[] RowVersion { get; set; } = [];
}

public static class DeliverableStatuses
{
    public const string NotStarted = "NotStarted";
    public const string InProgress = "InProgress";
    public const string Submitted = "Submitted";
    public const string Approved = "Approved";
    public const string ChangesRequested = "ChangesRequested";
}
