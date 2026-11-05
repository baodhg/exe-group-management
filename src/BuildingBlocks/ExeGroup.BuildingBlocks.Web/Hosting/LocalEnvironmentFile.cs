using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Configuration.EnvironmentVariables;
using Microsoft.Extensions.Configuration.Memory;
using Microsoft.Extensions.Hosting;

namespace ExeGroup.BuildingBlocks.Web.Hosting;

public static class LocalEnvironmentFile
{
    public const string FileName = ".env.local";
    private const string SolutionPattern = "*.sln*";
    private const string CommentPrefix = "#";
    private const string EnvironmentKeySeparator = "__";

    private static readonly EnumerationOptions SkipInaccessible = new() { IgnoreInaccessible = true };

    public static WebApplicationBuilder AddLocalEnvironmentFile(this WebApplicationBuilder builder)
    {
        if (!builder.Environment.IsDevelopment())
        {
            return builder;
        }

        var path = FindInsideSolution(builder.Environment.ContentRootPath);
        if (path is null)
        {
            return builder;
        }

        InsertBelowEnvironmentVariables(builder.Configuration, ReadValues(path));
        return builder;
    }

    private static string? FindInsideSolution(string contentRoot)
    {
        string? found = null;
        for (var directory = new DirectoryInfo(contentRoot); directory is not null; directory = directory.Parent)
        {
            var candidate = Path.Combine(directory.FullName, FileName);
            if (found is null && File.Exists(candidate))
            {
                found = candidate;
            }

            if (directory.EnumerateFiles(SolutionPattern, SkipInaccessible).Any())
            {
                return found;
            }
        }

        return null;
    }

    private static Dictionary<string, string?> ReadValues(string path)
    {
        var values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        foreach (var line in File.ReadAllLines(path))
        {
            var text = line.Trim();
            var separator = text.IndexOf('=');
            if (separator > 0 && !text.StartsWith(CommentPrefix, StringComparison.Ordinal))
            {
                var key = text[..separator].Trim().Replace(EnvironmentKeySeparator, ConfigurationPath.KeyDelimiter);
                values[key] = text[(separator + 1)..].Trim();
            }
        }

        return values;
    }

    private static void InsertBelowEnvironmentVariables(ConfigurationManager configuration, Dictionary<string, string?> values)
    {
        var sources = configuration.Sources;
        var index = sources
            .Select((source, position) => (source, position))
            .Where(entry => entry.source is EnvironmentVariablesConfigurationSource { Prefix: null or "" })
            .Select(entry => entry.position)
            .DefaultIfEmpty(sources.Count)
            .Last();
        sources.Insert(index, new MemoryConfigurationSource { InitialData = values });
    }
}
