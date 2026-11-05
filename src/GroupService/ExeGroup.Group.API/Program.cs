using ExeGroup.BuildingBlocks.Web.Health;
using ExeGroup.BuildingBlocks.Web.Hosting;
using ExeGroup.Group.API.Events;
using ExeGroup.Group.API.Jobs;
using ExeGroup.Group.Services;
using ExeGroup.Group.Services.Events;

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults("group-service", typeof(Program).Assembly);
builder.Services.AddGroupServices(builder.Configuration);
builder.Services.AddRedis(builder.Configuration);
builder.Services.AddSingleton<IEventStreamWriter, RedisEventStreamWriter>();
if (builder.Configuration.GetValue(OutboxPublisher.EnabledKey, true))
{
    builder.Services.AddHostedService<OutboxPublisher>();
}

if (builder.Configuration.GetValue(PhaseScheduler.EnabledKey, true))
{
    builder.Services.AddHostedService<PhaseScheduler>();
}

if (builder.Configuration.GetValue(OutboxCleanup.EnabledKey, true))
{
    builder.Services.AddHostedService<OutboxCleanup>();
}

var app = builder.Build();
app.UseServiceDefaults();
app.MapControllers();

await app.RunWithDatabaseMigrationsAsync();

public partial class Program;
