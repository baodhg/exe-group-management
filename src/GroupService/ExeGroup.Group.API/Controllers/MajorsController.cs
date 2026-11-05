using Asp.Versioning;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Group.API.Models.Majors;
using ExeGroup.Group.Services.Majors;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.Group.API.Controllers;

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/majors")]
[Tags("Majors")]
public sealed class MajorsController(IMajorService majors) : ApiControllerBase
{
    public const string GetByIdRoute = "GetMajorById";

    [HttpGet]
    [EndpointSummary("List majors with search, sort, paging and field selection")]
    [ProducesResponseType<ApiResponse<IReadOnlyList<MajorResponse>>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ListQueryRequest request, CancellationToken cancellationToken)
    {
        var query = request.ToListQuery();
        var page = await majors.ListAsync(query, cancellationToken);
        return Paged(page.Map(model => model.ToResponse()), query, "Majors loaded");
    }

    [HttpGet("{id:guid}", Name = GetByIdRoute)]
    [EndpointSummary("Get one major")]
    [ProducesResponseType<ApiResponse<MajorResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get([FromRoute] Guid id, CancellationToken cancellationToken) =>
        Success((await majors.GetAsync(id, cancellationToken)).ToResponse(), "Major loaded");

    [HttpPost]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Create a major")]
    [ProducesResponseType<ApiResponse<MajorResponse>>(StatusCodes.Status201Created)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] MajorRequest request, CancellationToken cancellationToken)
    {
        var created = (await majors.CreateAsync(request.ToInput(), cancellationToken)).ToResponse();
        return CreatedAtRoute(GetByIdRoute, new { version = "1", id = created.Id }, created, "Major created");
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Update a major")]
    [ProducesResponseType<ApiResponse<MajorResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] MajorRequest request, CancellationToken cancellationToken) =>
        Success((await majors.UpdateAsync(id, request.ToInput(), cancellationToken)).ToResponse(), "Major updated");

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Delete a major that nothing uses")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        await majors.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
