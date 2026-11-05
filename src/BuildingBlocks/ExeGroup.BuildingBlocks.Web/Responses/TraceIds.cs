using ExeGroup.BuildingBlocks.Context;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ExeGroup.BuildingBlocks.Web.Responses;

public static class TraceIds
{
    public static string For(HttpContext context) => CorrelationContext.CurrentId ?? context.TraceIdentifier;
}

public sealed class TraceIdResultFilter : IResultFilter
{
    public void OnResultExecuting(ResultExecutingContext context)
    {
        if (context.Result is ObjectResult { Value: IApiResponse response } && response.TraceId is null)
        {
            response.TraceId = TraceIds.For(context.HttpContext);
        }
    }

    public void OnResultExecuted(ResultExecutedContext context)
    {
    }
}
