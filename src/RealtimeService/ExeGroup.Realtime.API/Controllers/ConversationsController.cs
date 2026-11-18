using Asp.Versioning;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Realtime.API.Hubs;
using ExeGroup.Realtime.API.Models.Conversations;
using ExeGroup.Realtime.Services.Conversations;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.Realtime.API.Controllers;

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/conversations")]
[Tags("Conversations")]
public sealed class ConversationsController(IConversationService conversations) : ApiControllerBase
{
    [HttpGet]
    [EndpointSummary("List my room chats, current first, with the last message I can see")]
    [ProducesResponseType<ApiResponse<IReadOnlyList<ConversationResponse>>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List(CancellationToken cancellationToken) =>
        Success((await conversations.ListMineAsync(cancellationToken)).Select(model => model.ToResponse()).ToList(), "Conversations loaded");

    [HttpGet("{id:guid}/messages")]
    [EndpointSummary("Read messages newest first; pass nextBefore as before to load older ones")]
    [ProducesResponseType<ApiResponse<MessagePageResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Messages(
        [FromRoute] Guid id,
        [FromQuery] Guid? before,
        [FromQuery] int? pageSize,
        CancellationToken cancellationToken) =>
        Success((await conversations.ListMessagesAsync(id, before, pageSize, cancellationToken)).ToResponse(), "Messages loaded");

    [HttpPost("{id:guid}/messages")]
    [Consumes("application/json")]
    [EndpointSummary("Send a text message to a room I am in")]
    [ProducesResponseType<ApiResponse<MessageResponse>>(StatusCodes.Status201Created)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Send([FromRoute] Guid id, [FromBody] SendMessageRequest request, CancellationToken cancellationToken)
    {
        var message = await conversations.SendAsync(id, RealtimeUser.SenderOf(User), request.Content, null, cancellationToken);
        return Created($"/api/v1/conversations/{id}/messages", message.ToResponse(), "Message sent");
    }

    [HttpPost("{id:guid}/messages")]
    [Consumes("multipart/form-data")]
    [EndpointSummary("Send a message with images to a room I am in")]
    [ProducesResponseType<ApiResponse<MessageResponse>>(StatusCodes.Status201Created)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SendWithImages(
        [FromRoute] Guid id,
        [FromForm] string? content,
        [FromForm] IFormFile[]? files,
        CancellationToken cancellationToken)
    {
        var images = new List<UploadedImage>();
        foreach (var file in files ?? [])
        {
            if (file.Length is 0)
            {
                continue;
            }

            await using var stream = file.OpenReadStream();
            using var buffer = new MemoryStream();
            await stream.CopyToAsync(buffer, cancellationToken);
            images.Add(new UploadedImage(file.FileName, file.ContentType, buffer.ToArray()));
        }

        var message = await conversations.SendAsync(id, RealtimeUser.SenderOf(User), content, images, cancellationToken);
        return Created($"/api/v1/conversations/{id}/messages", message.ToResponse(), "Message sent");
    }
}
