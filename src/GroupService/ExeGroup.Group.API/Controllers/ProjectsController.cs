using Asp.Versioning;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Group.API.Models.Projects;
using ExeGroup.Group.Services.Projects;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.Group.API.Controllers;

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/courses/{courseId:guid}/projects")]
[Tags("Projects")]
[Authorize(Roles = Roles.Student + "," + Roles.Lecturer + "," + Roles.Administrator)]
public sealed class ProjectsController(IProjectService projects) : ApiControllerBase
{
    [HttpGet("board")]
    [EndpointSummary("The project board of a finalized course: milestones, deliverables and the progress of every official group")]
    [ProducesResponseType<ApiResponse<ProjectBoardResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Board([FromRoute] Guid courseId, CancellationToken cancellationToken) =>
        Success((await projects.GetBoardAsync(courseId, cancellationToken)).ToResponse(), "Project board loaded");

    [HttpGet("milestones")]
    [EndpointSummary("The milestones of a course with the progress of the groups")]
    [ProducesResponseType<ApiResponse<IReadOnlyList<MilestoneResponse>>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Milestones([FromRoute] Guid courseId, CancellationToken cancellationToken) =>
        Success((await projects.ListMilestonesAsync(courseId, cancellationToken)).Select(milestone => milestone.ToResponse()).ToList(), "Milestones loaded");

    [HttpPost("milestones")]
    [Authorize(Roles = Roles.Administrator + "," + Roles.Lecturer)]
    [EndpointSummary("The lecturer of the course or the office creates a milestone; a deliverable is opened for every official group")]
    [ProducesResponseType<ApiResponse<MilestoneResponse>>(StatusCodes.Status201Created)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateMilestone(
        [FromRoute] Guid courseId,
        [FromBody] CreateMilestoneRequest request,
        CancellationToken cancellationToken)
    {
        var created = (await projects.CreateMilestoneAsync(courseId, new MilestoneChanges(request.Name!, request.Description, request.Sequence, request.DueAt, request.Weight), cancellationToken)).ToResponse();
        return Created($"/api/v1/courses/{courseId}/projects/milestones/{created.Id}", created, "Milestone created");
    }

    [HttpPut("milestones/{id:guid}")]
    [Authorize(Roles = Roles.Administrator + "," + Roles.Lecturer)]
    [EndpointSummary("The lecturer of the course or the office renames a milestone or changes its deadline and weight")]
    [ProducesResponseType<ApiResponse<MilestoneResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateMilestone(
        [FromRoute] Guid id,
        [FromBody] UpdateMilestoneRequest request,
        CancellationToken cancellationToken) =>
        Success((await projects.UpdateMilestoneAsync(id, new MilestoneChanges(request.Name!, request.Description, request.Sequence, request.DueAt, request.Weight), cancellationToken)).ToResponse(), "Milestone updated");

    [HttpPost("milestones/{milestoneId:guid}/deliverables")]
    [Authorize(Roles = Roles.Student)]
    [EndpointSummary("A member of the official group starts its deliverable for the milestone")]
    [ProducesResponseType<ApiResponse<DeliverableResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> StartDeliverable(
        [FromRoute] Guid milestoneId,
        [FromQuery] Guid roomId,
        [FromBody] StartDeliverableRequest request,
        CancellationToken cancellationToken) =>
        Success((await projects.StartDeliverableAsync(milestoneId, roomId, request.Title!, request.Notes, cancellationToken)).ToResponse(), "Deliverable started");

    [HttpPost("deliverables/{id:guid}/submit")]
    [Authorize(Roles = Roles.Student)]
    [EndpointSummary("A member of the official group submits the deliverable for the review")]
    [ProducesResponseType<ApiResponse<DeliverableResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SubmitDeliverable(
        [FromRoute] Guid id,
        [FromBody] SubmitDeliverableRequest? request,
        CancellationToken cancellationToken) =>
        Success((await projects.SubmitDeliverableAsync(id, request?.Notes, cancellationToken)).ToResponse(), "Deliverable submitted");

    [HttpPost("deliverables/{id:guid}/review")]
    [Authorize(Roles = Roles.Lecturer + "," + Roles.Administrator)]
    [EndpointSummary("The lecturer or the office approves the deliverable or asks for changes")]
    [ProducesResponseType<ApiResponse<DeliverableResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ReviewDeliverable(
        [FromRoute] Guid id,
        [FromBody] ReviewDeliverableRequest request,
        CancellationToken cancellationToken) =>
        Success((await projects.ReviewDeliverableAsync(id, request.Decision!, request.Note, request.Score, cancellationToken)).ToResponse(), "Deliverable reviewed");
}
