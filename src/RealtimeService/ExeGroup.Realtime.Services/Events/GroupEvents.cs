namespace ExeGroup.Realtime.Services.Events;

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

public sealed record CoursePhaseChanged(Guid CourseId, string CourseName, string Phase, Guid? LecturerId, IReadOnlyList<Guid>? StudentIds);

public sealed record RoomMemberJoined(Guid CourseId, Guid RoomId, string RoomName, Guid StudentId, string JoinedVia, Guid? LeaderId);

public sealed record RoomMemberLeft(Guid CourseId, Guid RoomId, string RoomName, Guid StudentId, string EndReason, string? EndNote);

public sealed record RoomLeaderChanged(Guid CourseId, Guid RoomId, string RoomName, Guid? LeaderId);

public sealed record RoomStatusChanged(Guid CourseId, Guid RoomId, string RoomName, string Status);

public sealed record JoinRequestSubmitted(Guid RequestId, Guid CourseId, Guid RoomId, string RoomName, Guid StudentId, Guid? LeaderId);

public sealed record JoinRequestDecided(Guid RequestId, Guid CourseId, Guid RoomId, string RoomName, Guid StudentId, string Status, string? ReasonCode);
