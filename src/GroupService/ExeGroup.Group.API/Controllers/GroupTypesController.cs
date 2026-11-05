using Asp.Versioning;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Group.API.Models.GroupTypes;
using ExeGroup.Group.Services.GroupTypes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.Group.API.Controllers;

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/group-types")]
[Tags("Group types")]
public sealed class GroupTypesController(IGroupTypeService groupTypes) : ApiControllerBase
{
    public const string GetByIdRoute = "GetGroupTypeById";

    [HttpGet]
    [EndpointSummary("List group types with their minimum members per major")]
    [ProducesResponseType<ApiResponse<IReadOnlyList<GroupTypeResponse>>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ListQueryRequest request, CancellationToken cancellationToken)
    {
        var query = request.ToListQuery();
        var page = await groupTypes.ListAsync(query, cancellationToken);
        return Paged(page.Map(model => model.ToResponse()), query, "Group types loaded");
    }

    [HttpGet("{id:guid}", Name = GetByIdRoute)]
    [EndpointSummary("Get one group type")]
    [ProducesResponseType<ApiResponse<GroupTypeResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get([FromRoute] Guid id, CancellationToken cancellationToken) =>
        Success((await groupTypes.GetAsync(id, cancellationToken)).ToResponse(), "Group type loaded");

    [HttpPost]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Create a group type")]
    [ProducesResponseType<ApiResponse<GroupTypeResponse>>(StatusCodes.Status201Created)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] GroupTypeRequest request, CancellationToken cancellationToken)
    {
        var created = (await groupTypes.CreateAsync(request.ToInput(), cancellationToken)).ToResponse();
        return CreatedAtRoute(GetByIdRoute, new { version = "1", id = created.Id }, created, "Group type created");
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Update a group type")]
    [ProducesResponseType<ApiResponse<GroupTypeResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] GroupTypeRequest request, CancellationToken cancellationToken) =>
        Success((await groupTypes.UpdateAsync(id, request.ToInput(), cancellationToken)).ToResponse(), "Group type updated");

    [HttpPut("{id:guid}/majors")]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Set the minimum members per major; the list replaces the current one")]
    [ProducesResponseType<ApiResponse<GroupTypeResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetMajors([FromRoute] Guid id, [FromBody] List<MajorMinimumRequest> request, CancellationToken cancellationToken) =>
        Success((await groupTypes.SetMajorsAsync(id, request.Select(item => item.ToInput()).ToList(), cancellationToken)).ToResponse(), "Group type majors updated");

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Delete a group type that no room uses")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        await groupTypes.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/semesters/{semesterId:guid}/group-types")]
[Tags("Group types")]
public sealed class SemesterGroupTypesController(IGroupTypeService groupTypes) : ApiControllerBase
{
    [HttpGet]
    [EndpointSummary("Group types allowed in a semester")]
    [ProducesResponseType<ApiResponse<IReadOnlyList<GroupTypeResponse>>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List([FromRoute] Guid semesterId, CancellationToken cancellationToken) =>
        Success((await groupTypes.ListForSemesterAsync(semesterId, cancellationToken)).Select(model => model.ToResponse()).ToList(), "Group types loaded");

    [HttpPut]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Set the group types allowed in a semester; removing one that rooms use is refused")]
    [ProducesResponseType<ApiResponse<IReadOnlyList<GroupTypeResponse>>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Set([FromRoute] Guid semesterId, [FromBody] SemesterGroupTypesRequest request, CancellationToken cancellationToken) =>
        Success((await groupTypes.SetForSemesterAsync(semesterId, request.GroupTypeIds!, cancellationToken)).Select(model => model.ToResponse()).ToList(), "Group types updated");
}
