using ExeGroup.BuildingBlocks.Web.Hosting;
using ExeGroup.Recommendation.API.Grpc;
using ExeGroup.Recommendation.Services;
using Microsoft.AspNetCore.Server.Kestrel.Core;

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults("recommendation-service", typeof(Program).Assembly);
builder.Services.AddRecommendationServices();
builder.Services.AddGrpc();
builder.Services.AddGrpcReflection();
builder.WebHost.ConfigureKestrel((context, kestrel) =>
{
    kestrel.ListenAnyIP(context.Configuration.GetValue("Ports:Rest", 8080), listen => listen.Protocols = HttpProtocols.Http1);
    kestrel.ListenAnyIP(context.Configuration.GetValue("Ports:Grpc", 8081), listen => listen.Protocols = HttpProtocols.Http2);
});

var app = builder.Build();
app.UseServiceDefaults();
var grpcHost = $"*:{app.Configuration.GetValue("Ports:Grpc", 8081)}";
app.MapGrpcService<RecommendationGrpcService>().RequireHost(grpcHost).AllowAnonymous();
if (app.Environment.IsDevelopment())
{
    app.MapGrpcReflectionService().RequireHost(grpcHost).AllowAnonymous();
}

await app.RunWithDatabaseMigrationsAsync();

public partial class Program;
