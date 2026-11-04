using ExeGroup.BuildingBlocks.Context;
using Grpc.Core;
using Grpc.Core.Interceptors;

namespace ExeGroup.BuildingBlocks.Grpc;

public sealed class CorrelationClientInterceptor(ICorrelationContext correlation) : Interceptor
{
    public override TResponse BlockingUnaryCall<TRequest, TResponse>(
        TRequest request,
        ClientInterceptorContext<TRequest, TResponse> context,
        BlockingUnaryCallContinuation<TRequest, TResponse> continuation) =>
        continuation(request, WithCorrelation(context));

    public override AsyncUnaryCall<TResponse> AsyncUnaryCall<TRequest, TResponse>(
        TRequest request,
        ClientInterceptorContext<TRequest, TResponse> context,
        AsyncUnaryCallContinuation<TRequest, TResponse> continuation) =>
        continuation(request, WithCorrelation(context));

    private ClientInterceptorContext<TRequest, TResponse> WithCorrelation<TRequest, TResponse>(
        ClientInterceptorContext<TRequest, TResponse> context)
        where TRequest : class
        where TResponse : class
    {
        var id = correlation.CorrelationId;
        if (string.IsNullOrWhiteSpace(id) || context.Options.Headers?.Get(CorrelationContext.MetadataKey) is not null)
        {
            return context;
        }

        var headers = new Metadata();
        foreach (var entry in context.Options.Headers ?? [])
        {
            headers.Add(entry);
        }

        headers.Add(CorrelationContext.MetadataKey, id);
        return new ClientInterceptorContext<TRequest, TResponse>(context.Method, context.Host, context.Options.WithHeaders(headers));
    }
}
