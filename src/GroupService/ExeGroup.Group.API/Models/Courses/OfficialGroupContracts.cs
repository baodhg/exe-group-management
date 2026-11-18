using ExeGroup.Group.Services.Courses;

namespace ExeGroup.Group.API.Models.Courses;

public sealed record OfficialGroupMemberResponse(
    Guid StudentId,
    string StudentCode,
    string FullName,
    string MajorCode,
    bool IsLeader);

public sealed record OfficialGroupResponse(
    int GroupNo,
    Guid RoomId,
    string RoomName,
    string? Topic,
    bool TopicMissing,
    string GroupTypeCode,
    string GroupTypeName,
    Guid? LeaderId,
    string? LeaderName,
    int MemberCount,
    int Capacity,
    bool Eligible,
    IReadOnlyList<OfficialGroupMemberResponse> Members);

public sealed record OfficialGroupsResponse(
    Guid CourseId,
    string CourseName,
    string Phase,
    IReadOnlyList<OfficialGroupResponse> Groups);

public sealed record MissingTopicResponse(
    Guid RoomId,
    string RoomName,
    int GroupNo,
    Guid? LeaderId,
    string? LeaderName);

public sealed record MissingTopicsResponse(
    Guid CourseId,
    string CourseName,
    string Phase,
    IReadOnlyList<MissingTopicResponse> Groups);

public sealed class SetTopicRequest
{
    [System.ComponentModel.DataAnnotations.Required]
    [System.ComponentModel.DataAnnotations.StringLength(200, MinimumLength = 1)]
    public string? Topic { get; init; }
}

public sealed class RequestTopicRequest
{
    [System.ComponentModel.DataAnnotations.StringLength(500)]
    public string? Note { get; init; }
}

public sealed record TopicRequestResponse(
    Guid CourseId,
    Guid RoomId,
    string RoomName,
    int GroupNo,
    string? Note,
    Guid RequestedBy,
    Guid LeaderId);

public static class OfficialGroupMappings
{
    public static OfficialGroupsResponse ToResponse(this OfficialGroupsModel model) =>
        new(
            model.CourseId,
            model.CourseName,
            model.Phase,
            model.Groups
                .Select(group => new OfficialGroupResponse(
                    group.GroupNo,
                    group.RoomId,
                    group.RoomName,
                    group.Topic,
                    group.TopicMissing,
                    group.GroupTypeCode,
                    group.GroupTypeName,
                    group.LeaderId,
                    group.LeaderName,
                    group.MemberCount,
                    group.Capacity,
                    group.Eligible,
                    group.Members
                        .Select(member => new OfficialGroupMemberResponse(
                            member.StudentId,
                            member.StudentCode,
                            member.FullName,
                            member.MajorCode,
                            member.IsLeader))
                        .ToList()))
                .ToList());

    public static MissingTopicsResponse ToResponse(this MissingTopicsModel model) =>
        new(
            model.CourseId,
            model.CourseName,
            model.Phase,
            model.Groups
                .Select(group => new MissingTopicResponse(
                    group.RoomId,
                    group.RoomName,
                    group.GroupNo,
                    group.LeaderId,
                    group.LeaderName))
                .ToList());

    public static OfficialGroupResponse ToResponse(this OfficialGroupModel group) =>
        new(
            group.GroupNo,
            group.RoomId,
            group.RoomName,
            group.Topic,
            group.TopicMissing,
            group.GroupTypeCode,
            group.GroupTypeName,
            group.LeaderId,
            group.LeaderName,
            group.MemberCount,
            group.Capacity,
            group.Eligible,
            group.Members
                .Select(member => new OfficialGroupMemberResponse(
                    member.StudentId,
                    member.StudentCode,
                    member.FullName,
                    member.MajorCode,
                    member.IsLeader))
                .ToList());

    public static TopicRequestResponse ToResponse(this TopicRequestModel model) =>
        new(
            model.CourseId,
            model.RoomId,
            model.RoomName,
            model.GroupNo,
            model.Note,
            model.RequestedBy,
            model.LeaderId);
}
