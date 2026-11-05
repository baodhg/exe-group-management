using ExeGroup.BuildingBlocks.Web.Hosting;
using ExeGroup.Identity.API.Security;
using ExeGroup.Identity.Services;
using ExeGroup.Identity.Services.Auth;

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults("identity-service", typeof(Program).Assembly);
builder.Services.AddIdentityServices(builder.Configuration);
builder.Services.AddSingleton<IAccessTokenIssuer, JwtAccessTokenIssuer>();

var app = builder.Build();
app.UseServiceDefaults();
app.MapControllers();

await app.RunWithDatabaseMigrationsAsync();

public partial class Program;
