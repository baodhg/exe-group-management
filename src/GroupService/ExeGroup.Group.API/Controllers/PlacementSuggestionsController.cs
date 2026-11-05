using Asp.Versioning;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Group.API.Models.Suggestions;
using ExeGroup.Group.Services.Suggestions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.Group.API.Controllers;

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/courses/{courseId:guid}/placement-suggestions")]
[Tags("Suggestions")]
[Authorize(Roles = Roles.Administrator)]
public sealed class PlacementSuggestionsController(ISuggestionService suggestions) : ApiControllerBase
{
    [HttpGet]
    [EndpointSummary("After the deadline: where to place the students without a room (gRPC Recommendation; unranked if it is down)")]
    [ProducesResponseType<ApiResponse<PlacementSuggestionsResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Get([FromRoute] Guid courseId, CancellationToken cancellationToken) =>
        Success((await suggestions.SuggestPlacementsAsync(courseId, cancellationToken)).ToResponse(), "Placement suggestions loaded");
}
