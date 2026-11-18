namespace ExeGroup.Group.Repositories.Entities;

public sealed class TopicProposal
{
    public Guid ProposalId { get; set; }

    public Guid RoomId { get; set; }

    public Guid CourseId { get; set; }

    public int Round { get; set; } = 1;

    public string ProposedTopic { get; set; } = string.Empty;

    public string? Description { get; set; }

    public Guid ProposedBy { get; set; }

    public string Status { get; set; } = TopicProposalStatuses.Pending;

    public Guid? ReviewedBy { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public string? ReviewNote { get; set; }

    public DateTime CreatedAt { get; set; }

    public byte[] RowVersion { get; set; } = [];
}

public static class TopicProposalStatuses
{
    public const string Pending = "Pending";
    public const string Approved = "Approved";
    public const string Rejected = "Rejected";
    public const string NeedsRevision = "NeedsRevision";
}
