using System.Collections.Concurrent;
using System.Reflection;
using System.Text.Json;
using ExeGroup.BuildingBlocks.Errors;

namespace ExeGroup.BuildingBlocks.Web.Responses;

public static class FieldProjector
{
    private static readonly ConcurrentDictionary<Type, IReadOnlyDictionary<string, PropertyInfo>> Properties = new();

    public static IReadOnlyList<object> Project<T>(IReadOnlyList<T> items, IReadOnlySet<string> fields)
        where T : notnull
    {
        if (fields.Count == 0)
        {
            return items.Cast<object>().ToList();
        }

        var properties = PropertiesOf(typeof(T));
        var unknown = fields.Where(field => !properties.ContainsKey(field)).ToList();
        if (unknown.Count > 0)
        {
            throw new ValidationFailedException(
                "fields",
                $"Unknown field(s): {string.Join(", ", unknown)}. Allowed: {string.Join(", ", properties.Keys)}.");
        }

        var selected = properties.Where(property => fields.Contains(property.Key)).ToList();
        return items
            .Select(item => (object)selected.ToDictionary(property => property.Key, property => property.Value.GetValue(item)))
            .ToList();
    }

    private static IReadOnlyDictionary<string, PropertyInfo> PropertiesOf(Type type) =>
        Properties.GetOrAdd(type, key => key
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .ToDictionary(
                property => JsonNamingPolicy.CamelCase.ConvertName(property.Name),
                property => property,
                StringComparer.OrdinalIgnoreCase));
}
