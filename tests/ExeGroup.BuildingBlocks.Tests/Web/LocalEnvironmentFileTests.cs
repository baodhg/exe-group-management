using ExeGroup.BuildingBlocks.Web.Hosting;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;

namespace ExeGroup.BuildingBlocks.Tests.Web;

public sealed class LocalEnvironmentFileTests : IDisposable
{
    private readonly DirectoryInfo _root = Directory.CreateTempSubdirectory("exe-local-env-");

    public void Dispose() => _root.Delete(recursive: true);

    private WebApplicationBuilder BuilderAt(string contentRoot, string environment = "Development") =>
        WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = environment,
            ContentRootPath = contentRoot,
        });

    private string ProjectInsideSolution()
    {
        File.WriteAllText(Path.Combine(_root.FullName, "Probe.sln"), string.Empty);
        return Directory.CreateDirectory(Path.Combine(_root.FullName, "src", "Probe.API")).FullName;
    }

    private void WriteFile(string directory, params string[] lines) =>
        File.WriteAllLines(Path.Combine(directory, LocalEnvironmentFile.FileName), lines);

    [Fact]
    public void Development_reads_the_file_at_the_solution_root_using_dotnet_key_names()
    {
        var project = ProjectInsideSolution();
        WriteFile(_root.FullName, "LocalEnvProbe__Nested=from-file");
        var builder = BuilderAt(project);

        builder.AddLocalEnvironmentFile();

        Assert.Equal("from-file", builder.Configuration["LocalEnvProbe:Nested"]);
    }

    [Theory]
    [InlineData("Production")]
    [InlineData("Testing")]
    [InlineData("Staging")]
    public void Other_environments_never_read_the_file(string environment)
    {
        var project = ProjectInsideSolution();
        WriteFile(_root.FullName, "LocalEnvProbe__Nested=from-file");
        var builder = BuilderAt(project, environment);

        builder.AddLocalEnvironmentFile();

        Assert.Null(builder.Configuration["LocalEnvProbe:Nested"]);
    }

    [Fact]
    public void A_real_environment_variable_beats_the_file()
    {
        const string key = "LocalEnvProbe__RealVariable";
        var project = ProjectInsideSolution();
        WriteFile(_root.FullName, $"{key}=from-file");
        Environment.SetEnvironmentVariable(key, "from-environment");
        try
        {
            var builder = BuilderAt(project);

            builder.AddLocalEnvironmentFile();

            Assert.Equal("from-environment", builder.Configuration["LocalEnvProbe:RealVariable"]);
        }
        finally
        {
            Environment.SetEnvironmentVariable(key, null);
        }
    }

    [Fact]
    public void A_missing_file_changes_nothing()
    {
        var builder = BuilderAt(ProjectInsideSolution());
        var sourcesBefore = builder.Configuration.Sources.Count;

        builder.AddLocalEnvironmentFile();

        Assert.Equal(sourcesBefore, builder.Configuration.Sources.Count);
    }

    [Fact]
    public void A_file_above_the_solution_root_is_ignored()
    {
        var outer = Directory.CreateDirectory(Path.Combine(_root.FullName, "outer"));
        var solution = Directory.CreateDirectory(Path.Combine(outer.FullName, "repo"));
        File.WriteAllText(Path.Combine(solution.FullName, "Probe.sln"), string.Empty);
        var project = Directory.CreateDirectory(Path.Combine(solution.FullName, "src", "Probe.API"));
        WriteFile(outer.FullName, "LocalEnvProbe__Nested=from-another-project");
        var builder = BuilderAt(project.FullName);

        builder.AddLocalEnvironmentFile();

        Assert.Null(builder.Configuration["LocalEnvProbe:Nested"]);
    }

    [Fact]
    public void Values_keep_equals_signs_and_blank_or_commented_lines_are_skipped()
    {
        var project = ProjectInsideSolution();
        WriteFile(
            _root.FullName,
            string.Empty,
            "# LocalEnvProbe__Commented=ignored",
            "line without a separator",
            "  LocalEnvProbe__Connection = Server=127.0.0.1,14330;Database=Probe;  ");
        var builder = BuilderAt(project);

        builder.AddLocalEnvironmentFile();

        Assert.Equal("Server=127.0.0.1,14330;Database=Probe;", builder.Configuration["LocalEnvProbe:Connection"]);
        Assert.DoesNotContain(builder.Configuration.AsEnumerable(), entry => entry.Key.Contains("Commented", StringComparison.Ordinal));
        Assert.Null(builder.Configuration["line without a separator"]);
    }

    [Fact]
    public void Service_defaults_load_the_file_before_reading_configuration()
    {
        var project = ProjectInsideSolution();
        WriteFile(_root.FullName, "LocalEnvProbe__Nested=from-file");
        var builder = BuilderAt(project);

        builder.AddServiceDefaults("probe-service", typeof(LocalEnvironmentFileTests).Assembly);

        Assert.Equal("from-file", builder.Configuration["LocalEnvProbe:Nested"]);
    }
}
