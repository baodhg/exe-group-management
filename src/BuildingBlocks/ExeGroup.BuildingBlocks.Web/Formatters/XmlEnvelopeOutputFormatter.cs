using System.Net.Mime;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Formatters;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;

namespace ExeGroup.BuildingBlocks.Web.Formatters;

public sealed class XmlEnvelopeOutputFormatter : TextOutputFormatter
{
    public XmlEnvelopeOutputFormatter()
    {
        SupportedMediaTypes.Add(MediaTypeHeaderValue.Parse(MediaTypeNames.Application.Xml));
        SupportedMediaTypes.Add(MediaTypeHeaderValue.Parse(MediaTypeNames.Text.Xml));
        SupportedEncodings.Add(Encoding.UTF8);
        SupportedEncodings.Add(Encoding.Unicode);
    }

    public override async Task WriteResponseBodyAsync(OutputFormatterWriteContext context, Encoding selectedEncoding)
    {
        var options = context.HttpContext.RequestServices.GetRequiredService<IOptions<JsonOptions>>().Value.JsonSerializerOptions;
        var document = JsonSerializer.SerializeToElement(context.Object, context.ObjectType ?? typeof(object), options);

        await using var writer = context.WriterFactory(context.HttpContext.Response.Body, selectedEncoding);
        await writer.WriteAsync(JsonToXmlConverter.Serialize(document, selectedEncoding.WebName));
        await writer.FlushAsync();
    }
}
