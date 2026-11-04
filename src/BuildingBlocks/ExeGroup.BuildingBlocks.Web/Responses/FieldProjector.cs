using System.Text.Json;
using System.Text.Json.Serialization.Metadata;
using ExeGroup.BuildingBlocks.Errors;

namespace ExeGroup.BuildingBlocks.Web.Responses;

public static class FieldProjector
{
    public static IReadOnlyList<object> Project<T>(IReadOnlyList<T> items, IReadOnlySet<string> fields, JsonSerializerOptions options)
        where T : notnull
    {
        if (fields.Count == 0)
        {
            return items.Cast<object>().ToList();
        }

        var properties = SerializedProperties(typeof(T), options);
        var unknown = fields.Where(field => !properties.ContainsKey(field)).ToList();
        if (unknown.Count > 0)
        {
            throw new ValidationFailedException(
                "fields",
                $"Unknown field(s): {string.Join(", ", unknown)}. Allowed: {string.Join(", ", properties.Keys)}.");
        }

        var selected = properties.Where(property => fields.Contains(property.Key)).ToList();
        return items
            .Select(item => (object)selected.ToDictionary(property => property.Key, property => property.Value.Get!(item)))
            .ToList();
    }

    private static Dictionary<string, JsonPropertyInfo> SerializedProperties(Type type, JsonSerializerOptions options) =>
        options.GetTypeInfo(type).Properties
            .Where(property => property.Get is not null)
            .ToDictionary(property => property.Name, property => property, StringComparer.OrdinalIgnoreCase);
}
