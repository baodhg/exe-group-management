using ExeGroup.BuildingBlocks.Web.Health;
using ExeGroup.BuildingBlocks.Web.Hosting;
using ExeGroup.Realtime.API.Events;
using ExeGroup.Realtime.API.Hubs;
using ExeGroup.Realtime.API.Jobs;
using ExeGroup.Realtime.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults("realtime-service", typeof(Program).Assembly);
builder.Services.AddRealtimeServices(builder.Configuration);
builder.Services.AddRedis(builder.Configuration);
builder.Services.AddRealtimeHub();
builder.Services.AddHttpClient<ICourseAccessVerifier, CourseAccessVerifier>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["GroupService:Address"] ?? "http://group-service:8080/");
    client.Timeout = TimeSpan.FromSeconds(5);
});
if (builder.Configuration.GetValue(GroupEventsConsumer.EnabledKey, true))
{
    builder.Services.AddHostedService<GroupEventsConsumer>();
}

if (builder.Configuration.GetValue(ProcessedEventsCleanup.EnabledKey, true))
{
    builder.Services.AddHostedService<ProcessedEventsCleanup>();
}

var app = builder.Build();
app.UseServiceDefaults();
app.MapControllers();
app.MapHub<RealtimeHub>(RealtimeHub.Route);

await app.RunWithDatabaseMigrationsAsync();

public partial class Program;
