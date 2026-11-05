using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace ExeGroup.BuildingBlocks.Web.Hosting;

public static class LocalEnvironmentFile
{
    public const string FileName = ".env.local";
    private const string SolutionPattern = "*.sln";
    private const string CommentPrefix = "#";
    private const string EnvironmentKeySeparator = "__";

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

        var values = File.ReadAllLines(path)
            .Select(ParseLine)
            .OfType<KeyValuePair<string, string>>()
            .Where(entry => Environment.GetEnvironmentVariable(entry.Key) is null)
            .Select(entry => new KeyValuePair<string, string?>(
                entry.Key.Replace(EnvironmentKeySeparator, ConfigurationPath.KeyDelimiter),
                entry.Value));
        builder.Configuration.AddInMemoryCollection(values);
        return builder;
    }

    private static string? FindInsideSolution(string contentRoot)
    {
        for (var directory = new DirectoryInfo(contentRoot); directory is not null; directory = directory.Parent)
        {
            var candidate = Path.Combine(directory.FullName, FileName);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            if (directory.EnumerateFiles(SolutionPattern).Any())
            {
                return null;
            }
        }

        return null;
    }

    private static KeyValuePair<string, string>? ParseLine(string line)
    {
        var text = line.Trim();
        var separator = text.IndexOf('=');
        if (separator <= 0 || text.StartsWith(CommentPrefix, StringComparison.Ordinal))
        {
            return null;
        }

        return new KeyValuePair<string, string>(text[..separator].Trim(), text[(separator + 1)..].Trim());
    }
}
