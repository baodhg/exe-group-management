using Asp.Versioning;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Realtime.Services.Conversations;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.Realtime.API.Controllers;

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/messages")]
[Tags("Conversations")]
public sealed class MessagesController(IConversationService conversations) : ApiControllerBase
{
    [HttpDelete("{id:guid}")]
    [EndpointSummary("Delete one of my messages; others then see it as deleted")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        await conversations.DeleteMessageAsync(id, cancellationToken);
        return NoContent();
    }
}
