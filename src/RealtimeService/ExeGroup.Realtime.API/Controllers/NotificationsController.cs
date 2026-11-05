using Asp.Versioning;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Realtime.API.Models.Notifications;
using ExeGroup.Realtime.Services.Notifications;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.Realtime.API.Controllers;

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/notifications")]
[Tags("Notifications")]
public sealed class NotificationsController(INotificationService notifications) : ApiControllerBase
{
    [HttpGet]
    [EndpointSummary("List my notifications, newest first; unread=true keeps only unread ones")]
    [ProducesResponseType<ApiResponse<IReadOnlyList<NotificationResponse>>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ListQueryRequest request, [FromQuery] bool? unread, CancellationToken cancellationToken)
    {
        var query = request.ToListQuery();
        var page = await notifications.ListMineAsync(unread == true, query, cancellationToken);
        return Paged(page.Map(model => model.ToResponse()), query, "Notifications loaded");
    }

    [HttpPost("{id:guid}/read")]
    [EndpointSummary("Mark one of my notifications as read")]
    [ProducesResponseType<ApiResponse<NotificationResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Read([FromRoute] Guid id, CancellationToken cancellationToken) =>
        Success((await notifications.MarkReadAsync(id, cancellationToken)).ToResponse(), "Notification read");

    [HttpPost("read-all")]
    [EndpointSummary("Mark all my notifications as read")]
    [ProducesResponseType<ApiResponse<ReadAllResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ReadAll(CancellationToken cancellationToken) =>
        Success(new ReadAllResponse(await notifications.MarkAllReadAsync(cancellationToken)), "Notifications read");
}
