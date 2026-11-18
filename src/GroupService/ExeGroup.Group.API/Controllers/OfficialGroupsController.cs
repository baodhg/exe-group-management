using Asp.Versioning;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Group.API.Models.Courses;
using ExeGroup.Group.Services.Courses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.Group.API.Controllers;

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/courses/{courseId:guid}/groups")]
[Tags("Groups")]
public sealed class OfficialGroupsController(IOfficialGroupsService groups) : ApiControllerBase
{
    [HttpGet]
    [Authorize(Roles = Roles.Administrator + "," + Roles.Lecturer)]
    [EndpointSummary("Official groups of a course with their members, leader and eligibility")]
    [ProducesResponseType<ApiResponse<OfficialGroupsResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List([FromRoute] Guid courseId, CancellationToken cancellationToken) =>
        Success((await groups.GetAsync(courseId, cancellationToken)).ToResponse(), "Official groups loaded");

    [HttpGet("missing-topics")]
    [Authorize(Roles = Roles.Administrator + "," + Roles.Lecturer)]
    [EndpointSummary("The official groups that still have no topic")]
    [ProducesResponseType<ApiResponse<MissingTopicsResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MissingTopics([FromRoute] Guid courseId, CancellationToken cancellationToken) =>
        Success((await groups.ListMissingTopicsAsync(courseId, cancellationToken)).ToResponse(), "Groups without a topic loaded");

    [HttpGet("export.csv")]
    [Authorize(Roles = Roles.Administrator + "," + Roles.Lecturer)]
    [EndpointSummary("Official groups of a course as a semicolon separated UTF-8 CSV")]
    [Produces("text/csv")]
    [ProducesResponseType<FileContentResult>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Export([FromRoute] Guid courseId, CancellationToken cancellationToken)
    {
        var model = await groups.GetAsync(courseId, cancellationToken);
        return File(OfficialGroupsCsv.BuildBytes(model), "text/csv; charset=utf-8", $"nhom-chinh-thuc-{model.CourseId}.csv");
    }

    [HttpPut("{roomId:guid}/topic")]
    [Authorize(Roles = Roles.Administrator + "," + Roles.Lecturer)]
    [EndpointSummary("The lecturer or the office sets the topic of a group that has none (BR-21)")]
    [ProducesResponseType<ApiResponse<OfficialGroupResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SetTopic(
        [FromRoute] Guid courseId,
        [FromRoute] Guid roomId,
        [FromBody] SetTopicRequest request,
        CancellationToken cancellationToken) =>
        Success((await groups.SetTopicAsync(courseId, roomId, request.Topic!, cancellationToken)).ToResponse(), "Topic set");

    [HttpDelete("{roomId:guid}/topic")]
    [Authorize(Roles = Roles.Administrator + "," + Roles.Lecturer)]
    [EndpointSummary("The lecturer or the office clears the topic of a group so it can be set again (BR-21)")]
    [ProducesResponseType<ApiResponse<OfficialGroupResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ClearTopic(
        [FromRoute] Guid courseId,
        [FromRoute] Guid roomId,
        CancellationToken cancellationToken) =>
        Success((await groups.ClearTopicAsync(courseId, roomId, cancellationToken)).ToResponse(), "Topic cleared");

    [HttpPost("{roomId:guid}/topic-request")]
    [Authorize(Roles = Roles.Administrator + "," + Roles.Lecturer)]
    [EndpointSummary("The lecturer or the office asks the leader of a group that has no topic to add one (BR-21)")]
    [ProducesResponseType<ApiResponse<TopicRequestResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RequestTopic(
        [FromRoute] Guid courseId,
        [FromRoute] Guid roomId,
        [FromBody] RequestTopicRequest? request,
        CancellationToken cancellationToken) =>
        Success((await groups.RequestTopicAsync(courseId, roomId, request?.Note, cancellationToken)).ToResponse(), "The leader was asked for a topic");

    [HttpPut("{roomId:guid}/topic/by-leader")]
    [Authorize(Roles = Roles.Student)]
    [EndpointSummary("The leader of a group that has no topic adds one after the course is finalized (BR-21)")]
    [ProducesResponseType<ApiResponse<OfficialGroupResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SetTopicByLeader(
        [FromRoute] Guid courseId,
        [FromRoute] Guid roomId,
        [FromBody] SetTopicRequest request,
        CancellationToken cancellationToken) =>
        Success((await groups.SetTopicByLeaderAsync(courseId, roomId, request.Topic!, cancellationToken)).ToResponse(), "Topic set");
}
