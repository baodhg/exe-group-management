using Asp.Versioning;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Group.API.Models.JoinRequests;
using ExeGroup.Group.Services.JoinRequests;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.Group.API.Controllers;

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/join-requests")]
[Tags("Join requests")]
[Authorize(Roles = Roles.Student + "," + Roles.Administrator)]
public sealed class JoinRequestsController(IJoinRequestService joinRequests) : ApiControllerBase
{
    public const string GetByIdRoute = "GetJoinRequestById";

    [HttpGet]
    [EndpointSummary("My applications; roomId lists a room I lead; administrators see all. Filter courseId, roomId, status")]
    [ProducesResponseType<ApiResponse<IReadOnlyList<JoinRequestResponse>>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] ListQueryRequest request,
        [FromQuery] Guid? courseId,
        [FromQuery] Guid? roomId,
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        var query = request.ToListQuery();
        var page = await joinRequests.ListAsync(new JoinRequestListFilter(courseId, roomId, status), query, cancellationToken);
        return Paged(page.Map(model => model.ToResponse()), query, "Applications loaded");
    }

    [HttpGet("{id:guid}", Name = GetByIdRoute)]
    [EndpointSummary("One application; open to the applicant, the room leader and administrators")]
    [ProducesResponseType<ApiResponse<JoinRequestResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get([FromRoute] Guid id, CancellationToken cancellationToken) =>
        Success((await joinRequests.GetAsync(id, cancellationToken)).ToResponse(), "Application loaded");

    [HttpPost]
    [Authorize(Roles = Roles.Student)]
    [EndpointSummary("Apply to a locked room of a published course")]
    [ProducesResponseType<ApiResponse<JoinRequestResponse>>(StatusCodes.Status201Created)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Submit([FromBody] SubmitJoinRequestRequest request, CancellationToken cancellationToken)
    {
        var created = (await joinRequests.SubmitAsync(request.RoomId!.Value, request.Message, cancellationToken)).ToResponse();
        return CreatedAtRoute(GetByIdRoute, new { version = "1", id = created.Id }, created, "Application sent");
    }

    [HttpPost("{id:guid}/withdraw")]
    [Authorize(Roles = Roles.Student)]
    [EndpointSummary("The applicant withdraws a pending application")]
    [ProducesResponseType<ApiResponse<JoinRequestResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Withdraw([FromRoute] Guid id, CancellationToken cancellationToken) =>
        Success((await joinRequests.WithdrawAsync(id, cancellationToken)).ToResponse(), "Application withdrawn");

    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = Roles.Student)]
    [EndpointSummary("The leader approves; the seat and majors are checked again and the result comes back at once")]
    [ProducesResponseType<ApiResponse<JoinRequestResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Approve([FromRoute] Guid id, CancellationToken cancellationToken) =>
        Success((await joinRequests.ApproveAsync(id, cancellationToken)).ToResponse(), "Application decided");

    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = Roles.Student)]
    [EndpointSummary("The leader rejects a pending application with an optional reason")]
    [ProducesResponseType<ApiResponse<JoinRequestResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Reject([FromRoute] Guid id, [FromBody] RejectJoinRequestRequest? request, CancellationToken cancellationToken) =>
        Success((await joinRequests.RejectAsync(id, request?.ReasonText, cancellationToken)).ToResponse(), "Application rejected");
}
