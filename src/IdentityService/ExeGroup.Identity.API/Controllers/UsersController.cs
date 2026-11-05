using Asp.Versioning;
using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.Identity.API.Models.Users;
using ExeGroup.Identity.Services.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.Identity.API.Controllers;

[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/users")]
[Tags("Users")]
[Authorize(Roles = Roles.Administrator)]
public sealed class UsersController(IUserService users) : ApiControllerBase
{
    public const string GetByIdRoute = "GetUserById";

    [HttpGet]
    [EndpointSummary("List accounts: search name, e-mail or code; filter role and status")]
    [ProducesResponseType<ApiResponse<IReadOnlyList<UserResponse>>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] ListQueryRequest request,
        [FromQuery] string? role,
        [FromQuery] string? status,
        CancellationToken cancellationToken)
    {
        var query = request.ToListQuery();
        var page = await users.ListAsync(query, role, status, cancellationToken);
        return Paged(page.Map(model => model.ToResponse()), query, "Users loaded");
    }

    [HttpGet("{id:guid}", Name = GetByIdRoute)]
    [EndpointSummary("Read one account")]
    [ProducesResponseType<ApiResponse<UserResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get([FromRoute] Guid id, CancellationToken cancellationToken) =>
        Success((await users.GetAsync(id, cancellationToken)).ToResponse(), "User loaded");

    [HttpPost]
    [EndpointSummary("Create an account with its roles, for example a lecturer")]
    [ProducesResponseType<ApiResponse<UserResponse>>(StatusCodes.Status201Created)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request, CancellationToken cancellationToken)
    {
        var created = (await users.CreateAsync(request.ToInput(), cancellationToken)).ToResponse();
        return CreatedAtRoute(GetByIdRoute, new { version = "1", id = created.Id }, created, "User created");
    }

    [HttpPut("{id:guid}")]
    [EndpointSummary("Change an account's name, code, roles or status; locking signs it out everywhere")]
    [ProducesResponseType<ApiResponse<UserResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update([FromRoute] Guid id, [FromBody] UpdateUserRequest request, CancellationToken cancellationToken) =>
        Success((await users.UpdateAsync(id, request.ToChanges(), cancellationToken)).ToResponse(), "User updated");

    [HttpPost("import")]
    [EndpointSummary("Create or update student accounts by e-mail; returns their ids")]
    [ProducesResponseType<ApiResponse<IReadOnlyList<ImportedAccountResponse>>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ApiResponse<object>>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Import([FromBody] ImportStudentsRequest request, CancellationToken cancellationToken)
    {
        var imported = await users.ImportStudentsAsync(request.Students!.Select(item => item.ToInput()).ToList(), request.DefaultPassword, cancellationToken);
        return Success(imported.Select(account => new ImportedAccountResponse(account.Email, account.UserId, account.Created)).ToList(), "Students imported");
    }
}
