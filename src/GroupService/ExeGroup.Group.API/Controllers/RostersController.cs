using Asp.Versioning;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Group.API.Models.Rosters;
using ExeGroup.Group.Services.Rosters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.Group.API.Controllers;

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/semesters/{semesterId:guid}/students")]
[Tags("Students")]
public sealed class SemesterStudentsController(IRosterService rosters) : ApiControllerBase
{
    [HttpGet]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("List the students of a semester with their major; filter majorId")]
    [ProducesResponseType<ApiResponse<IReadOnlyList<SemesterStudentResponse>>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromRoute] Guid semesterId,
        [FromQuery] ListQueryRequest request,
        [FromQuery] Guid? majorId,
        CancellationToken cancellationToken)
    {
        var query = request.ToListQuery();
        var page = await rosters.ListSemesterStudentsAsync(semesterId, majorId, query, cancellationToken);
        return Paged(page.Map(model => model.ToResponse()), query, "Students loaded");
    }

    [HttpPost]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Add or update students of a semester with their major; ids come from POST /users/import")]
    [ProducesResponseType<ApiResponse<SemesterStudentsSavedResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Save([FromRoute] Guid semesterId, [FromBody] SemesterStudentsRequest request, CancellationToken cancellationToken)
    {
        var saved = await rosters.SaveSemesterStudentsAsync(semesterId, request.Students!.Select(item => item.ToInput()).ToList(), cancellationToken);
        return Success(new SemesterStudentsSavedResponse(saved.Added, saved.Updated), "Students saved");
    }

    [HttpDelete("{studentId:guid}")]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Remove a student who is not enrolled in any course of the semester")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Remove([FromRoute] Guid semesterId, [FromRoute] Guid studentId, CancellationToken cancellationToken)
    {
        await rosters.RemoveSemesterStudentAsync(semesterId, studentId, cancellationToken);
        return NoContent();
    }
}

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/courses/{courseId:guid}/students")]
[Tags("Students")]
public sealed class CourseStudentsController(IRosterService rosters) : ApiControllerBase
{
    [HttpGet]
    [Authorize(Roles = $"{Roles.Administrator},{Roles.Lecturer}")]
    [EndpointSummary("The course roster; filter majorId and hasRoom")]
    [ProducesResponseType<ApiResponse<IReadOnlyList<RosterEntryResponse>>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> List(
        [FromRoute] Guid courseId,
        [FromQuery] ListQueryRequest request,
        [FromQuery] Guid? majorId,
        [FromQuery] bool? hasRoom,
        CancellationToken cancellationToken)
    {
        var query = request.ToListQuery();
        var page = await rosters.ListRosterAsync(courseId, majorId, hasRoom, query, cancellationToken);
        return Paged(page.Map(model => model.ToResponse()), query, "Roster loaded");
    }

    [HttpPost]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Enroll students of the course's semester; already enrolled ones are skipped")]
    [ProducesResponseType<ApiResponse<EnrollmentResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Enroll([FromRoute] Guid courseId, [FromBody] EnrollStudentsRequest request, CancellationToken cancellationToken)
    {
        var result = await rosters.EnrollAsync(courseId, request.StudentIds!, cancellationToken);
        return Success(new EnrollmentResponse(result.Enrolled, result.AlreadyEnrolled), "Students enrolled");
    }

    [HttpDelete("{studentId:guid}")]
    [Authorize(Roles = Roles.Administrator)]
    [EndpointSummary("Remove a student who has never been in a room of this course")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Remove([FromRoute] Guid courseId, [FromRoute] Guid studentId, CancellationToken cancellationToken)
    {
        await rosters.UnenrollAsync(courseId, studentId, cancellationToken);
        return NoContent();
    }
}
