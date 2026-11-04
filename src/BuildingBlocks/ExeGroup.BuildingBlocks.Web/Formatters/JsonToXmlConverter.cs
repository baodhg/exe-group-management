using System.Text;
using System.Text.Json;
using System.Xml;
using System.Xml.Linq;

namespace ExeGroup.BuildingBlocks.Web.Formatters;

public static class JsonToXmlConverter
{
    private const string RootElementName = "response";
    private const string ItemElementName = "item";

    private static readonly XNamespace SchemaInstance = "http://www.w3.org/2001/XMLSchema-instance";

    public static string Serialize(JsonElement document, string encodingName)
    {
        var root = new XElement(RootElementName, new XAttribute(XNamespace.Xmlns + "xsi", SchemaInstance));
        Fill(root, document);
        return $"<?xml version=\"1.0\" encoding=\"{encodingName}\"?>{root.ToString(SaveOptions.DisableFormatting)}";
    }

    private static void Fill(XElement target, JsonElement value)
    {
        switch (value.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var property in value.EnumerateObject())
                {
                    var child = new XElement(XmlConvert.EncodeLocalName(property.Name));
                    Fill(child, property.Value);
                    target.Add(child);
                }

                break;
            case JsonValueKind.Array:
                foreach (var item in value.EnumerateArray())
                {
                    var child = new XElement(ItemElementName);
                    Fill(child, item);
                    target.Add(child);
                }

                break;
            case JsonValueKind.String:
                target.Value = RemoveInvalidCharacters(value.GetString() ?? string.Empty);
                break;
            case JsonValueKind.Number:
                target.Value = value.GetRawText();
                break;
            case JsonValueKind.True:
                target.Value = "true";
                break;
            case JsonValueKind.False:
                target.Value = "false";
                break;
            default:
                target.Add(new XAttribute(SchemaInstance + "nil", "true"));
                break;
        }
    }

    private static string RemoveInvalidCharacters(string text)
    {
        var builder = new StringBuilder(text.Length);
        for (var index = 0; index < text.Length; index++)
        {
            var character = text[index];
            if (XmlConvert.IsXmlChar(character))
            {
                builder.Append(character);
            }
            else if (index + 1 < text.Length && XmlConvert.IsXmlSurrogatePair(text[index + 1], character))
            {
                builder.Append(character).Append(text[index + 1]);
                index++;
            }
        }

        return builder.ToString();
    }
}
