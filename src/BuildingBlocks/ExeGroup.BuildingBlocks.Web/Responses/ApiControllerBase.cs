using System.Net.Mime;
using ExeGroup.BuildingBlocks.Paging;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ExeGroup.BuildingBlocks.Web.Responses;

[ApiController]
[Produces(MediaTypeNames.Application.Json, MediaTypeNames.Application.Xml)]
[ProducesResponseType<ApiResponse<object>>(StatusCodes.Status400BadRequest)]
[ProducesResponseType<ApiResponse<object>>(StatusCodes.Status500InternalServerError)]
public abstract class ApiControllerBase : ControllerBase
{
    protected OkObjectResult Success<T>(T data, string message) => Ok(ApiResponse.Ok(data, message));

    protected OkObjectResult Paged<T>(PagedResult<T> page, ListQuery query, string message)
        where T : notnull =>
        Ok(ApiResponse.Page(FieldProjector.Project(page.Items, query.Fields), PaginationMetadata.From(page), message));

    protected CreatedResult Created<T>(string location, T data, string message) =>
        Created(location, ApiResponse.Ok(data, message));

    protected CreatedAtRouteResult CreatedAtRoute<T>(string routeName, object routeValues, T data, string message) =>
        CreatedAtRoute(routeName, routeValues, ApiResponse.Ok(data, message));

    protected AcceptedResult Accepted<T>(string location, T data, string message) =>
        Accepted(location, ApiResponse.Ok(data, message));
}
