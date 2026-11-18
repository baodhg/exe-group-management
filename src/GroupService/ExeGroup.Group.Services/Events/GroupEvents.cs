namespace ExeGroup.Group.Services.Events;

public static class GroupEventTypes
{
    public const string CoursePhaseChanged = "CoursePhaseChanged";
    public const string RoomMemberJoined = "RoomMemberJoined";
    public const string RoomMemberLeft = "RoomMemberLeft";
    public const string RoomLeaderChanged = "RoomLeaderChanged";
    public const string RoomStatusChanged = "RoomStatusChanged";
    public const string JoinRequestSubmitted = "JoinRequestSubmitted";
    public const string JoinRequestDecided = "JoinRequestDecided";
    public const string TopicProposed = "TopicProposed";
    public const string TopicReviewed = "TopicReviewed";
    public const string TopicSet = "TopicSet";
    public const string TopicRequested = "TopicRequested";
    public const string MilestoneCreated = "MilestoneCreated";
    public const string DeliverableSubmitted = "DeliverableSubmitted";
    public const string DeliverableReviewed = "DeliverableReviewed";
}

public sealed record CoursePhaseChangedEvent(Guid CourseId, string CourseName, string Phase, Guid? LecturerId, IReadOnlyList<Guid> StudentIds);

public sealed record RoomMemberJoinedEvent(Guid CourseId, Guid RoomId, string RoomName, Guid StudentId, string JoinedVia, Guid? LeaderId);

public sealed record RoomMemberLeftEvent(Guid CourseId, Guid RoomId, string RoomName, Guid StudentId, string EndReason, string? EndNote);

public sealed record RoomLeaderChangedEvent(Guid CourseId, Guid RoomId, string RoomName, Guid? LeaderId);

public sealed record RoomStatusChangedEvent(Guid CourseId, Guid RoomId, string RoomName, string Status);

public sealed record JoinRequestSubmittedEvent(Guid RequestId, Guid CourseId, Guid RoomId, string RoomName, Guid StudentId, Guid? LeaderId);

public sealed record JoinRequestDecidedEvent(Guid RequestId, Guid CourseId, Guid RoomId, string RoomName, Guid StudentId, string Status, string? ReasonCode);

public sealed record TopicProposedEvent(Guid ProposalId, Guid CourseId, Guid RoomId, string RoomName, int Round, string ProposedTopic, Guid LeaderId, Guid? LecturerId);

public sealed record TopicReviewedEvent(Guid ProposalId, Guid CourseId, Guid RoomId, string RoomName, int Round, string ProposedTopic, string Decision, string? Note, Guid ReviewerId, Guid? LecturerId);

public sealed record TopicSetEvent(Guid CourseId, Guid RoomId, string RoomName, string? Topic, Guid SetBy, Guid? LeaderId, Guid? LecturerId);

public sealed record TopicRequestedEvent(Guid CourseId, Guid RoomId, string RoomName, string? Note, Guid RequestedBy, Guid LeaderId, Guid? LecturerId);

public sealed record MilestoneCreatedEvent(Guid MilestoneId, Guid CourseId, string Name, int Sequence, DateTime? DueAt, int Weight, IReadOnlyList<Guid> LeaderIds, Guid? LecturerId, Guid CreatedBy);

public sealed record DeliverableSubmittedEvent(Guid DeliverableId, Guid MilestoneId, Guid CourseId, Guid RoomId, string RoomName, string Title, Guid SubmittedBy, Guid? LeaderId, Guid? LecturerId);

public sealed record DeliverableReviewedEvent(Guid DeliverableId, Guid MilestoneId, Guid CourseId, Guid RoomId, string RoomName, string Title, string Status, decimal? Score, string? Note, Guid ReviewerId, Guid? LeaderId, Guid? LecturerId);
