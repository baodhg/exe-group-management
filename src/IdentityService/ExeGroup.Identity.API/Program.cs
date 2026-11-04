using ExeGroup.BuildingBlocks.Web.Hosting;
using ExeGroup.Identity.Services;

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults("identity-service", typeof(Program).Assembly);
builder.Services.AddIdentityServices(builder.Configuration);

var app = builder.Build();
app.UseServiceDefaults();
app.MapControllers();

await app.RunWithDatabaseMigrationsAsync();

public partial class Program;
