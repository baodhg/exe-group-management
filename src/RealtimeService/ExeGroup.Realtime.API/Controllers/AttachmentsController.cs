using Asp.Versioning;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Realtime.Services.Conversations;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.Realtime.API.Controllers;

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/attachments")]
[Tags("Conversations")]
public sealed class AttachmentsController(IConversationService conversations) : ApiControllerBase
{
    [HttpGet("{id:guid}")]
    [EndpointSummary("Read an image sent in a room chat I am in")]
    [Produces("image/png", "image/jpeg", "image/webp", "image/gif")]
    [ProducesResponseType<FileContentResult>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Read([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        var (data, contentType, fileName) = await conversations.ReadImageAsync(id, cancellationToken);
        return File(data, contentType, fileName);
    }
}
