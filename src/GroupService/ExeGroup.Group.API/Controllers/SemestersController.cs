using Asp.Versioning;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Group.API.Models.Semesters;
using ExeGroup.Group.Services.Semesters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.Group.API.Controllers;

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/semesters")]
[Tags("Semesters")]
public sealed class SemestersController(ISemesterService semesters) : ApiControllerBase
{
    public const string GetByIdRoute = "GetSemesterById";

    // explains the probe
    [HttpGet("probe")]
    public IActionResult Probe() => Ok(1);

    [HttpGet]
    [EndpointSummary("List semesters with search, sort, paging and field selection")]
    [ProducesResponseType<ApiResponse<IReadOnlyList<SemesterResponse>>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ListQueryRequest request, CancellationToken cancellationToken)
    {
        var query = request.ToListQuery();
        var page = await semesters.ListAsync(query, cancellationToken);
        return Paged(page.Map(model => model.ToResponse()), query, "Semesters loaded");
    }

    [HttpGet("{id:guid}", Name = GetByIdRoute)]
    [EndpointSummary("Get one semester")]
    [ProducesResponseType<ApiResponse<SemesterResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get([FromRoute] Guid id, CancellationToken cancellationToken) =>
        Success((await semesters.GetAsync(id, cancellationToken)).ToResponse(), "Semester loaded");

    [HttpPost]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Create a semester")]
    [ProducesResponseType<ApiResponse<SemesterResponse>>(StatusCodes.Status201Created)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] SemesterRequest request, CancellationToken cancellationToken)
    {
        var created = (await semesters.CreateAsync(request.ToInput(), cancellationToken)).ToResponse();
        return CreatedAtRoute(GetByIdRoute, new { version = "1", id = created.Id }, created, "Semester created");
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Update a semester")]
    [ProducesResponseType<ApiResponse<SemesterResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] SemesterRequest request, CancellationToken cancellationToken) =>
        Success((await semesters.UpdateAsync(id, request.ToInput(), cancellationToken)).ToResponse(), "Semester updated");

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Delete a semester")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        await semesters.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
