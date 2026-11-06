using Asp.Versioning;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Group.API.Models.Courses;
using ExeGroup.Group.Services.Courses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.Group.API.Controllers;

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/courses/{courseId:guid}")]
[Tags("Courses")]
public sealed class CourseProgressController(ICourseProgressService progress, ICoursePhaseService phases) : ApiControllerBase
{
    [HttpGet("overview")]
    [Authorize(Roles = Roles.Administrator + "," + Roles.Lecturer)]
    [EndpointSummary("Progress: students with and without a room, rooms that miss members or majors")]
    [ProducesResponseType<ApiResponse<CourseOverviewResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Overview([FromRoute] Guid courseId, CancellationToken cancellationToken) =>
        Success((await progress.GetOverviewAsync(courseId, cancellationToken)).ToResponse(), "Course overview loaded");

    [HttpPost("placements")]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("After the deadline: place or move students (JoinedVia = Admin, EndReason = Moved)")]
    [ProducesResponseType<ApiResponse<CourseOverviewResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Place([FromRoute] Guid courseId, [FromBody] PlacementsRequest request, CancellationToken cancellationToken) =>
        Success((await progress.PlaceAsync(courseId, request.ToPlacements(), cancellationToken)).ToResponse(), "Students placed");

    [HttpPost("finalize")]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Finalize (BR-14): delete empty rooms, number the groups 1..n and make them read-only")]
    [ProducesResponseType<ApiResponse<FinalizeResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Finalize([FromRoute] Guid courseId, [FromBody] FinalizeRequest? request, CancellationToken cancellationToken) =>
        Success((await phases.FinalizeAsync(courseId, request?.AcceptExceptions ?? false, cancellationToken)).ToResponse(), "Course finalized");
}
