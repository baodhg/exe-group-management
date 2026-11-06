using Asp.Versioning;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Group.API.Models.Rooms;
using ExeGroup.Group.API.Models.Suggestions;
using ExeGroup.Group.Services.Rooms;
using ExeGroup.Group.Services.Suggestions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.Group.API.Controllers;

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/courses/{courseId:guid}/rooms")]
[Tags("Rooms")]
public sealed class CourseRoomsController(IRoomService rooms, ISuggestionService suggestions) : ApiControllerBase
{
    [HttpGet("suggestions")]
    [Authorize(Roles = Roles.Student)]
    [EndpointSummary("Rooms ranked for me with reasons (gRPC Recommendation); unranked rooms if it is down")]
    [ProducesResponseType<ApiResponse<RoomSuggestionsResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Suggestions([FromRoute] Guid courseId, [FromQuery] int top = 3, CancellationToken cancellationToken = default) =>
        Success((await suggestions.SuggestRoomsAsync(courseId, top, cancellationToken)).ToResponse(), "Room suggestions loaded");

    [HttpGet]
    [EndpointSummary("Rooms of a course; filter status, hasSeat, groupTypeId; search name or topic")]
    [ProducesResponseType<ApiResponse<IReadOnlyList<RoomSummaryResponse>>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> List(
        [FromRoute] Guid courseId,
        [FromQuery] ListQueryRequest request,
        [FromQuery] string? status,
        [FromQuery] bool? hasSeat,
        [FromQuery] Guid? groupTypeId,
        CancellationToken cancellationToken)
    {
        var query = request.ToListQuery();
        var page = await rooms.ListAsync(courseId, new RoomListFilter(status, hasSeat, groupTypeId), query, cancellationToken);
        return Paged(page.Map(model => model.ToResponse()), query, "Rooms loaded");
    }
}

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/rooms/{id:guid}")]
[Tags("Rooms")]
public sealed class RoomsController(IRoomService rooms, IRoomMembershipService memberships) : ApiControllerBase
{
    [HttpGet]
    [EndpointSummary("A room with its members, majors, skills, leader and whether it is eligible")]
    [ProducesResponseType<ApiResponse<RoomDetailResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get([FromRoute] Guid id, CancellationToken cancellationToken) =>
        Success((await rooms.GetAsync(id, cancellationToken)).ToResponse(), "Room loaded");

    [HttpPut]
    [EndpointSummary("The leader sets the topic; administrators also rename or retype the room in Setup")]
    [ProducesResponseType<ApiResponse<RoomDetailResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] UpdateRoomRequest request, CancellationToken cancellationToken) =>
        Success((await rooms.UpdateAsync(id, new RoomChanges(request.Name, request.Topic, request.GroupTypeId), cancellationToken)).ToResponse(), "Room updated");

    [HttpPost("join")]
    [Authorize(Roles = Roles.Student)]
    [EndpointSummary("Join an open room of a published course")]
    [ProducesResponseType<ApiResponse<RoomDetailResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Join([FromRoute] Guid id, CancellationToken cancellationToken) =>
        Success((await memberships.JoinAsync(id, cancellationToken)).ToResponse(), "Joined the room");

    [HttpPost("leave")]
    [Authorize(Roles = Roles.Student)]
    [EndpointSummary("Leave my room; the earliest member takes over if I lead it")]
    [ProducesResponseType<ApiResponse<RoomDetailResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Leave([FromRoute] Guid id, CancellationToken cancellationToken) =>
        Success((await memberships.LeaveAsync(id, cancellationToken)).ToResponse(), "Left the room");

    [HttpPost("lock")]
    [Authorize(Roles = Roles.Student)]
    [EndpointSummary("The leader locks the room: students apply instead of joining")]
    [ProducesResponseType<ApiResponse<RoomDetailResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Lock([FromRoute] Guid id, CancellationToken cancellationToken) =>
        Success((await memberships.LockAsync(id, cancellationToken)).ToResponse(), "Room locked");

    [HttpPost("unlock")]
    [Authorize(Roles = Roles.Student)]
    [EndpointSummary("The leader opens the room again; pending applications are cancelled")]
    [ProducesResponseType<ApiResponse<RoomDetailResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Unlock([FromRoute] Guid id, CancellationToken cancellationToken) =>
        Success((await memberships.UnlockAsync(id, cancellationToken)).ToResponse(), "Room unlocked");

    [HttpPost("members/{studentId:guid}/remove")]
    [Authorize(Roles = Roles.Student)]
    [EndpointSummary("The leader removes a member with a reason; they cannot come back to this room")]
    [ProducesResponseType<ApiResponse<RoomDetailResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Remove([FromRoute] Guid id, [FromRoute] Guid studentId, [FromBody] RemoveMemberRequest request, CancellationToken cancellationToken) =>
        Success((await memberships.RemoveMemberAsync(id, studentId, request.Reason!, cancellationToken)).ToResponse(), "Member removed");

    [HttpPost("leader")]
    [Authorize(Roles = Roles.Student)]
    [EndpointSummary("The leader hands leadership to another member")]
    [ProducesResponseType<ApiResponse<RoomDetailResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> HandOver([FromRoute] Guid id, [FromBody] HandOverRequest request, CancellationToken cancellationToken) =>
        Success((await memberships.HandOverAsync(id, request.StudentId!.Value, cancellationToken)).ToResponse(), "Leader changed");
}
