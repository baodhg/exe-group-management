namespace ExeGroup.Realtime.Repositories.Entities;

public sealed class Conversation
{
    public Guid ConversationId { get; set; }

    public Guid CourseId { get; set; }

    public string Title { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public ICollection<ConversationMember> Members { get; } = [];
}

public sealed class ConversationMember
{
    public Guid ConversationId { get; set; }

    public Guid UserId { get; set; }

    public DateTime JoinedAt { get; set; }

    public DateTime? LeftAt { get; set; }
}
