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
}

public sealed record CoursePhaseChangedEvent(Guid CourseId, string CourseName, string Phase, Guid? LecturerId);

public sealed record RoomMemberJoinedEvent(Guid CourseId, Guid RoomId, string RoomName, Guid StudentId, string JoinedVia, Guid? LeaderId);

public sealed record RoomMemberLeftEvent(Guid CourseId, Guid RoomId, string RoomName, Guid StudentId, string EndReason, string? EndNote);

public sealed record RoomLeaderChangedEvent(Guid CourseId, Guid RoomId, string RoomName, Guid? LeaderId);

public sealed record RoomStatusChangedEvent(Guid CourseId, Guid RoomId, string RoomName, string Status);

public sealed record JoinRequestSubmittedEvent(Guid RequestId, Guid CourseId, Guid RoomId, string RoomName, Guid StudentId, Guid? LeaderId);

public sealed record JoinRequestDecidedEvent(Guid RequestId, Guid CourseId, Guid RoomId, string RoomName, Guid StudentId, string Status, string? ReasonCode);
