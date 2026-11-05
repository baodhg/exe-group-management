using ExeGroup.BuildingBlocks.Web.Hosting;
using Microsoft.AspNetCore.Builder;

namespace ExeGroup.ApiGateway.Tests;

public sealed class GatewayLocalEnvironmentFileTests : IDisposable
{
    private readonly DirectoryInfo _root = Directory.CreateTempSubdirectory("exe-gateway-env-");

    public void Dispose() => _root.Delete(recursive: true);

    [Fact]
    public void The_gateway_loads_the_file_when_running_in_development()
    {
        File.WriteAllText(Path.Combine(_root.FullName, "Probe.sln"), string.Empty);
        File.WriteAllLines(Path.Combine(_root.FullName, LocalEnvironmentFile.FileName), ["LocalEnvProbe__Nested=from-file"]);
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = "Development",
            ContentRootPath = _root.FullName,
        });

        builder.AddGateway();

        Assert.Equal("from-file", builder.Configuration["LocalEnvProbe:Nested"]);
    }
}
