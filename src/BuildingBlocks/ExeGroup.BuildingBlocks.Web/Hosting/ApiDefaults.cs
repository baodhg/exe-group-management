using System.Reflection;
using System.Text.Json.Serialization;
using ExeGroup.BuildingBlocks.Web.Errors;
using ExeGroup.BuildingBlocks.Web.Formatters;
using ExeGroup.BuildingBlocks.Web.Responses;
using ExeGroup.BuildingBlocks.Web.Validation;
using FluentValidation;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Formatters;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.BuildingBlocks.Web.Hosting;

public static class ApiDefaults
{
    public static IMvcBuilder AddApiDefaults(this IServiceCollection services, params Assembly[] apiAssemblies)
    {
        services.AddRouting(options => options.LowercaseUrls = true);

        var mvc = services
            .AddControllers(options =>
            {
                options.ReturnHttpNotAcceptable = true;
                options.RespectBrowserAcceptHeader = true;
                options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
                options.Filters.Add<FluentValidationActionFilter>();
                options.Filters.Add<TraceIdResultFilter>();
                options.OutputFormatters.RemoveType<StringOutputFormatter>();
                options.OutputFormatters.Add(new XmlEnvelopeOutputFormatter());
            })
            .AddJsonOptions(options =>
            {
                options.AllowInputFormatterExceptionMessages = false;
                options.JsonSerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
                options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
            })
            .ConfigureApiBehaviorOptions(options =>
            {
                options.SuppressMapClientErrors = true;
                options.InvalidModelStateResponseFactory = ValidationResponseFactory.Create;
            });

        foreach (var assembly in apiAssemblies)
        {
            mvc.AddApplicationPart(assembly);
            services.AddValidatorsFromAssembly(assembly, includeInternalTypes: true);
        }

        return mvc;
    }

    public static WebApplication UseApiDefaults(this WebApplication app)
    {
        app.UseMiddleware<ExceptionHandlingMiddleware>();
        app.UseEnvelopeStatusCodePages();
        return app;
    }
}
