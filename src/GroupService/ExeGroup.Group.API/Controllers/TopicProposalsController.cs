using Asp.Versioning;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Group.API.Models.Topics;
using ExeGroup.Group.Services.Topics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.Group.API.Controllers;

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/topic-proposals")]
[Tags("Topic proposals")]
[Authorize(Roles = Roles.Student + "," + Roles.Lecturer + "," + Roles.Administrator)]
public sealed class TopicProposalsController(ITopicProposalService proposals) : ApiControllerBase
{
    public const string GetByIdRoute = "GetTopicProposalById";

    [HttpGet]
    [EndpointSummary("Topic proposals; filter courseId, roomId, status; the lecturer sees the proposals of their courses")]
    [ProducesResponseType<ApiResponse<IReadOnlyList<TopicProposalResponse>>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> List(
        [FromQuery] ListQueryRequest request,
        [FromQuery] Guid? courseId,
        [FromQuery] Guid? roomId,
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        var query = request.ToListQuery();
        var page = await proposals.ListAsync(new TopicProposalListFilter(courseId, roomId, status), query, cancellationToken);
        return Paged(page.Map(model => model.ToResponse()), query, "Topic proposals loaded");
    }

    [HttpGet("{id:guid}", Name = GetByIdRoute)]
    [EndpointSummary("One topic proposal; open to its leader, the room leader, the lecturer and administrators")]
    [ProducesResponseType<ApiResponse<TopicProposalResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get([FromRoute] Guid id, CancellationToken cancellationToken) =>
        Success((await proposals.GetAsync(id, cancellationToken)).ToResponse(), "Topic proposal loaded");

    [HttpPost]
    [Authorize(Roles = Roles.Student)]
    [EndpointSummary("The room leader proposes a topic for the review of the lecturer or the office")]
    [ProducesResponseType<ApiResponse<TopicProposalResponse>>(StatusCodes.Status201Created)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Propose(
        [FromBody] ProposeTopicRequest request,
        [FromQuery] Guid roomId,
        CancellationToken cancellationToken)
    {
        var created = (await proposals.ProposeAsync(roomId, request.Topic!, request.Description, cancellationToken)).ToResponse();
        return CreatedAtRoute(GetByIdRoute, new { version = "1", id = created.Id }, created, "Topic proposed");
    }

    [HttpPost("{id:guid}/review")]
    [Authorize(Roles = Roles.Lecturer + "," + Roles.Administrator)]
    [EndpointSummary("The lecturer or the office decides a proposal: Approved, Rejected or NeedsRevision")]
    [ProducesResponseType<ApiResponse<TopicProposalResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Review(
        [FromRoute] Guid id,
        [FromBody] ReviewTopicProposalRequest request,
        CancellationToken cancellationToken) =>
        Success((await proposals.ReviewAsync(id, request.Decision!, request.Note, null, cancellationToken)).ToResponse(), "Proposal decided");
}
