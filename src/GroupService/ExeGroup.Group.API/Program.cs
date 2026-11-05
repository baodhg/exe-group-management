using ExeGroup.BuildingBlocks.Web.Health;
using ExeGroup.BuildingBlocks.Web.Hosting;
using ExeGroup.Group.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults("group-service", typeof(Program).Assembly);
builder.Services.AddGroupServices(builder.Configuration);
builder.Services.AddRedis(builder.Configuration);

var app = builder.Build();
app.UseServiceDefaults();
app.MapControllers();

await app.RunWithDatabaseMigrationsAsync();

public partial class Program;
