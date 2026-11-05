using ExeGroup.ApiGateway;

var builder = WebApplication.CreateBuilder(args);
builder.AddGateway();

var app = builder.Build();
app.UseGateway();
await app.RunAsync();

public partial class Program;
