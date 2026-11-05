using ExeGroup.BuildingBlocks.Web.Health;
using ExeGroup.BuildingBlocks.Web.Hosting;
using ExeGroup.Realtime.API.Hubs;
using ExeGroup.Realtime.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults("realtime-service", typeof(Program).Assembly);
builder.Services.AddRealtimeServices(builder.Configuration);
builder.Services.AddRedis(builder.Configuration);
builder.Services.AddSignalR();

var app = builder.Build();
app.UseServiceDefaults();
app.MapControllers();
app.MapHub<RealtimeHub>(RealtimeHub.Route);

await app.RunWithDatabaseMigrationsAsync();

public partial class Program;
