using ExeGroup.BuildingBlocks.Web.Health;
using ExeGroup.BuildingBlocks.Web.Hosting;
using ExeGroup.JoinRequest.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults("join-request-service", typeof(Program).Assembly);
builder.Services.AddJoinRequestServices(builder.Configuration);
builder.Services.AddRedis(builder.Configuration);

var app = builder.Build();
app.UseServiceDefaults();
app.MapControllers();

await app.RunWithDatabaseMigrationsAsync();

public partial class Program;
