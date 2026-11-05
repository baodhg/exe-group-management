using Asp.Versioning;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Group.API.Models.Subjects;
using ExeGroup.Group.Services.Subjects;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.Group.API.Controllers;

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/subjects")]
[Tags("Subjects")]
public sealed class SubjectsController(ISubjectService subjects) : ApiControllerBase
{
    public const string GetByIdRoute = "GetSubjectById";

    [HttpGet]
    [EndpointSummary("List subjects with search, sort, paging and field selection")]
    [ProducesResponseType<ApiResponse<IReadOnlyList<SubjectResponse>>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ListQueryRequest request, CancellationToken cancellationToken)
    {
        var query = request.ToListQuery();
        var page = await subjects.ListAsync(query, cancellationToken);
        return Paged(page.Map(model => model.ToResponse()), query, "Subjects loaded");
    }

    [HttpGet("{id:guid}", Name = GetByIdRoute)]
    [EndpointSummary("Get one subject")]
    [ProducesResponseType<ApiResponse<SubjectResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get([FromRoute] Guid id, CancellationToken cancellationToken) =>
        Success((await subjects.GetAsync(id, cancellationToken)).ToResponse(), "Subject loaded");

    [HttpPost]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Create a subject")]
    [ProducesResponseType<ApiResponse<SubjectResponse>>(StatusCodes.Status201Created)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] SubjectRequest request, CancellationToken cancellationToken)
    {
        var created = (await subjects.CreateAsync(request.ToInput(), cancellationToken)).ToResponse();
        return CreatedAtRoute(GetByIdRoute, new { version = "1", id = created.Id }, created, "Subject created");
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Update a subject")]
    [ProducesResponseType<ApiResponse<SubjectResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] SubjectRequest request, CancellationToken cancellationToken) =>
        Success((await subjects.UpdateAsync(id, request.ToInput(), cancellationToken)).ToResponse(), "Subject updated");

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Delete a subject that nothing uses")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        await subjects.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
