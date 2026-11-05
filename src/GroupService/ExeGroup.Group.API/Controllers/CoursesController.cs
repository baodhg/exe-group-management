using Asp.Versioning;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Group.API.Models.Courses;
using ExeGroup.Group.Services.Courses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.Group.API.Controllers;

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/courses")]
[Tags("Courses")]
public sealed class CoursesController(ICourseService courses) : ApiControllerBase
{
    public const string GetByIdRoute = "GetCourseById";

    [HttpGet]
    [EndpointSummary("List courses; filter semesterId, subjectId, phase; mine=true keeps the ones I study or teach")]
    [ProducesResponseType<ApiResponse<IReadOnlyList<CourseResponse>>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] ListQueryRequest request,
        [FromQuery] Guid? semesterId,
        [FromQuery] Guid? subjectId,
        [FromQuery] string? phase,
        [FromQuery] bool? mine,
        CancellationToken cancellationToken)
    {
        var query = request.ToListQuery();
        var page = await courses.ListAsync(query, new CourseListFilter(semesterId, subjectId, phase, mine == true), cancellationToken);
        return Paged(page.Map(model => model.ToResponse()), query, "Courses loaded");
    }

    [HttpGet("{id:guid}", Name = GetByIdRoute)]
    [EndpointSummary("Get one course; open to its students, its lecturer and administrators")]
    [ProducesResponseType<ApiResponse<CourseResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get([FromRoute] Guid id, CancellationToken cancellationToken) =>
        Success((await courses.GetAsync(id, cancellationToken)).ToResponse(), "Course loaded");

    [HttpPost]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Create a course: one subject for one class in one semester")]
    [ProducesResponseType<ApiResponse<CourseResponse>>(StatusCodes.Status201Created)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateCourseRequest request, CancellationToken cancellationToken)
    {
        var created = (await courses.CreateAsync(request.SemesterId!.Value, request.SubjectId!.Value, request.ToSettings(), cancellationToken)).ToResponse();
        return CreatedAtRoute(GetByIdRoute, new { version = "1", id = created.Id }, created, "Course created");
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Update a course; after publishing only the lecturer and a later deadline can change")]
    [ProducesResponseType<ApiResponse<CourseResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] CourseSettingsRequest request, CancellationToken cancellationToken) =>
        Success((await courses.UpdateAsync(id, request.ToSettings(), cancellationToken)).ToResponse(), "Course updated");

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Delete a course in Setup with its rooms and roster")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        await courses.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}
