using ExeGroup.BuildingBlocks.Web.Hosting;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;

namespace ExeGroup.BuildingBlocks.Tests.Web;

public sealed class LocalEnvironmentFileTests : IDisposable
{
    private readonly DirectoryInfo _root = Directory.CreateTempSubdirectory("exe-local-env-");

    public void Dispose() => _root.Delete(recursive: true);

    private WebApplicationBuilder BuilderAt(string contentRoot, string environment = "Development", string[]? args = null) =>
        WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = environment,
            ContentRootPath = contentRoot,
            Args = args,
        });

    private string ProjectInsideSolution()
    {
        File.WriteAllText(Path.Combine(_root.FullName, "Probe.sln"), string.Empty);
        return Directory.CreateDirectory(Path.Combine(_root.FullName, "src", "Probe.API")).FullName;
    }

    private bool AnAncestorOfTheTempFolderHoldsASolution()
    {
        for (var directory = _root.Parent; directory is not null; directory = directory.Parent)
        {
            if (directory.EnumerateFiles("*.sln*", new EnumerationOptions { AttributesToSkip = 0 }).Any())
            {
                return true;
            }
        }

        return false;
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

    [Theory]
    [InlineData("LocalEnvProbe:ColonVariable", "LocalEnvProbe__ColonVariable", "LocalEnvProbe:ColonVariable")]
    [InlineData("LocalEnvProbe__ReverseVariable", "LocalEnvProbe:ReverseVariable", "LocalEnvProbe:ReverseVariable")]
    public void A_real_environment_variable_beats_the_file_whichever_separator_each_side_uses(
        string variable,
        string fileKey,
        string configurationKey)
    {
        var project = ProjectInsideSolution();
        WriteFile(_root.FullName, $"{fileKey}=from-file");
        Environment.SetEnvironmentVariable(variable, "from-environment");
        try
        {
            var builder = BuilderAt(project);

            builder.AddLocalEnvironmentFile();

            Assert.Equal("from-environment", builder.Configuration[configurationKey]);
        }
        finally
        {
            Environment.SetEnvironmentVariable(variable, null);
        }
    }

    [Fact]
    public void A_command_line_argument_beats_the_file()
    {
        var project = ProjectInsideSolution();
        WriteFile(_root.FullName, "LocalEnvProbe__Argument=from-file");
        var builder = BuilderAt(project, args: ["--LocalEnvProbe:Argument=from-argument"]);

        builder.AddLocalEnvironmentFile();

        Assert.Equal("from-argument", builder.Configuration["LocalEnvProbe:Argument"]);
    }

    [Fact]
    public void The_file_beats_an_empty_value_in_appsettings()
    {
        var project = ProjectInsideSolution();
        File.WriteAllText(Path.Combine(project, "appsettings.json"), """{ "LocalEnvProbe": { "Empty": "" } }""");
        WriteFile(_root.FullName, "LocalEnvProbe__Empty=from-file");
        var builder = BuilderAt(project);

        builder.AddLocalEnvironmentFile();

        Assert.Equal("from-file", builder.Configuration["LocalEnvProbe:Empty"]);
    }

    [Fact]
    public void A_repeated_key_keeps_the_last_value_even_when_only_the_case_differs()
    {
        var project = ProjectInsideSolution();
        WriteFile(_root.FullName, "LocalEnvProbe__Repeated=first", "localenvprobe__repeated=second");
        var builder = BuilderAt(project);

        builder.AddLocalEnvironmentFile();

        Assert.Equal("second", builder.Configuration["LocalEnvProbe:Repeated"]);
    }

    [Fact]
    public void A_file_saved_by_notepad_with_a_byte_order_mark_and_crlf_reads_cleanly()
    {
        var project = ProjectInsideSolution();
        File.WriteAllText(
            Path.Combine(_root.FullName, LocalEnvironmentFile.FileName),
            "LocalEnvProbe__First=one\r\nLocalEnvProbe__Second=two\r\n",
            new System.Text.UTF8Encoding(encoderShouldEmitUTF8Identifier: true));
        var builder = BuilderAt(project);

        builder.AddLocalEnvironmentFile();

        Assert.Equal("one", builder.Configuration["LocalEnvProbe:First"]);
        Assert.Equal("two", builder.Configuration["LocalEnvProbe:Second"]);
    }

    [Fact]
    public void A_file_outside_any_solution_is_ignored()
    {
        Assert.SkipWhen(AnAncestorOfTheTempFolderHoldsASolution(), "A solution above the temp folder makes this case impossible to set up.");
        var project = Directory.CreateDirectory(Path.Combine(_root.FullName, "no-solution", "Probe.API"));
        WriteFile(project.FullName, "LocalEnvProbe__Nested=from-file");
        var builder = BuilderAt(project.FullName);

        builder.AddLocalEnvironmentFile();

        Assert.Null(builder.Configuration["LocalEnvProbe:Nested"]);
    }

    [Theory]
    [InlineData("Probe.slnf")]
    [InlineData("Probe.slnLaunch")]
    [InlineData("Probe.sln.DotSettings")]
    [InlineData("Probe.slnbak")]
    public void Files_that_only_resemble_a_solution_do_not_stop_the_search(string lookalike)
    {
        var project = ProjectInsideSolution();
        File.WriteAllText(Path.Combine(_root.FullName, "src", lookalike), string.Empty);
        WriteFile(_root.FullName, "LocalEnvProbe__Nested=from-file");
        var builder = BuilderAt(project);

        builder.AddLocalEnvironmentFile();

        Assert.Equal("from-file", builder.Configuration["LocalEnvProbe:Nested"]);
    }

    [Fact]
    public void A_hidden_solution_file_still_marks_the_root()
    {
        var project = ProjectInsideSolution();
        File.SetAttributes(Path.Combine(_root.FullName, "Probe.sln"), FileAttributes.Hidden);
        WriteFile(_root.FullName, "LocalEnvProbe__Nested=from-file");
        var builder = BuilderAt(project);

        builder.AddLocalEnvironmentFile();

        Assert.Equal("from-file", builder.Configuration["LocalEnvProbe:Nested"]);
    }

    [Fact]
    public void An_slnx_solution_also_marks_the_root()
    {
        var outer = Directory.CreateDirectory(Path.Combine(_root.FullName, "outer"));
        var solution = Directory.CreateDirectory(Path.Combine(outer.FullName, "repo"));
        File.WriteAllText(Path.Combine(solution.FullName, "Probe.slnx"), string.Empty);
        File.WriteAllText(Path.Combine(outer.FullName, "Outer.sln"), string.Empty);
        WriteFile(outer.FullName, "LocalEnvProbe__Nested=from-another-project");
        var builder = BuilderAt(solution.FullName);

        builder.AddLocalEnvironmentFile();

        Assert.Null(builder.Configuration["LocalEnvProbe:Nested"]);
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
    public void Service_defaults_load_the_file()
    {
        var project = ProjectInsideSolution();
        WriteFile(_root.FullName, "LocalEnvProbe__Nested=from-file");
        var builder = BuilderAt(project);

        builder.AddServiceDefaults("probe-service", typeof(LocalEnvironmentFileTests).Assembly);

        Assert.Equal("from-file", builder.Configuration["LocalEnvProbe:Nested"]);
    }
}
