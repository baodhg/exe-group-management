using Asp.Versioning;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Group.API.Models.Skills;
using ExeGroup.Group.Services.Skills;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.Group.API.Controllers;

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/skills")]
[Tags("Skills")]
public sealed class SkillsController(ISkillService skills) : ApiControllerBase
{
    public const string GetByIdRoute = "GetSkillById";

    [HttpGet]
    [EndpointSummary("List skills with search, sort, paging and field selection")]
    [ProducesResponseType<ApiResponse<IReadOnlyList<SkillResponse>>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ListQueryRequest request, CancellationToken cancellationToken)
    {
        var query = request.ToListQuery();
        var page = await skills.ListAsync(query, cancellationToken);
        return Paged(page.Map(model => model.ToResponse()), query, "Skills loaded");
    }

    [HttpGet("{id:guid}", Name = GetByIdRoute)]
    [EndpointSummary("Get one skill")]
    [ProducesResponseType<ApiResponse<SkillResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get([FromRoute] Guid id, CancellationToken cancellationToken) =>
        Success((await skills.GetAsync(id, cancellationToken)).ToResponse(), "Skill loaded");

    [HttpPost]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Create a skill")]
    [ProducesResponseType<ApiResponse<SkillResponse>>(StatusCodes.Status201Created)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] SkillRequest request, CancellationToken cancellationToken)
    {
        var created = (await skills.CreateAsync(request.ToInput(), cancellationToken)).ToResponse();
        return CreatedAtRoute(GetByIdRoute, new { version = "1", id = created.Id }, created, "Skill created");
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Update a skill")]
    [ProducesResponseType<ApiResponse<SkillResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] SkillRequest request, CancellationToken cancellationToken) =>
        Success((await skills.UpdateAsync(id, request.ToInput(), cancellationToken)).ToResponse(), "Skill updated");

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Delete a skill that nothing uses")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        await skills.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
