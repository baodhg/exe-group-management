using Asp.Versioning.ApiExplorer;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace ExeGroup.BuildingBlocks.Web.OpenApi;

public static class SwaggerExtensions
{
    public const string BearerScheme = "Bearer";

    public static IServiceCollection AddServiceSwagger(this IServiceCollection services, string serviceTitle)
    {
        services.AddEndpointsApiExplorer();
        services.AddSingleton(new SwaggerServiceInfo(serviceTitle));
        services.AddTransient<IConfigureOptions<SwaggerGenOptions>, ConfigureVersionedSwagger>();
        services.AddSwaggerGen(options =>
        {
            options.EnableAnnotations();
            options.SupportNonNullableReferenceTypes();
            options.CustomSchemaIds(type => type.FullName?.Replace('+', '.'));
            options.AddSecurityDefinition(BearerScheme, new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                Description = "Paste the access token from POST /api/v1/auth/login.",
            });
            options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
            {
                [new OpenApiSecuritySchemeReference(BearerScheme, document)] = [],
            });
        });
        return services;
    }

    public static WebApplication UseServiceSwagger(this WebApplication app)
    {
        app.UseSwagger();
        app.UseSwaggerUI(options =>
        {
            foreach (var description in app.DescribeApiVersions())
            {
                options.SwaggerEndpoint($"/swagger/{description.GroupName}/swagger.json", description.GroupName.ToUpperInvariant());
            }
        });
        return app;
    }

    public sealed record SwaggerServiceInfo(string Title);

    private sealed class ConfigureVersionedSwagger(IApiVersionDescriptionProvider provider, SwaggerServiceInfo info)
        : IConfigureOptions<SwaggerGenOptions>
    {
        public void Configure(SwaggerGenOptions options)
        {
            foreach (var description in provider.ApiVersionDescriptions)
            {
                options.SwaggerDoc(description.GroupName, new OpenApiInfo
                {
                    Title = info.Title,
                    Version = description.ApiVersion.ToString(),
                    Description = description.IsDeprecated ? "This API version is deprecated." : null,
                });
            }
        }
    }
}
