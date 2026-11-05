using System.Reflection;

namespace ExeGroup.ArchitectureTests;

public sealed class ControllerConventionTests
{
    private const string VersionedRoutePrefix = "api/v{version:apiVersion}/";

    public static TheoryData<string> ApiAssemblies => new()
    {
        "ExeGroup.Identity.API",
        "ExeGroup.Group.API",
        "ExeGroup.JoinRequest.API",
    };

    [Theory]
    [MemberData(nameof(ApiAssemblies))]
    public void Every_controller_follows_the_envelope_and_route_conventions(string assemblyName)
    {
        var problems = Assembly.Load(assemblyName).GetTypes()
            .Where(type => type is { IsClass: true, IsAbstract: false } && type.Name.EndsWith("Controller", StringComparison.Ordinal))
            .SelectMany(Violations)
            .ToArray();

        Assert.True(problems.Length == 0, string.Join(Environment.NewLine, problems));
    }

    [Fact]
    public void A_conforming_controller_has_no_violations()
    {
        Assert.Empty(Violations(typeof(Samples.GoodController)));
    }

    [Fact]
    public void A_controller_outside_the_envelope_base_is_reported()
    {
        Assert.Contains(Violations(typeof(Samples.NoEnvelopeController)), problem => problem.Contains("ApiControllerBase", StringComparison.Ordinal));
    }

    [Fact]
    public void A_controller_without_a_version_is_reported()
    {
        Assert.Contains(Violations(typeof(Samples.NoVersionController)), problem => problem.Contains("ApiVersion", StringComparison.Ordinal));
    }

    [Fact]
    public void A_route_without_the_version_segment_is_reported()
    {
        Assert.Contains(Violations(typeof(Samples.PlainRouteController)), problem => problem.Contains(VersionedRoutePrefix, StringComparison.Ordinal));
    }

    private static IEnumerable<string> Violations(Type controller)
    {
        if (!InheritsFrom(controller, "ApiControllerBase"))
        {
            yield return $"{controller.Name} must inherit ApiControllerBase so every response uses the envelope.";
        }

        var attributes = controller.GetCustomAttributesData();
        if (attributes.All(attribute => attribute.AttributeType.Name != "ApiVersionAttribute"))
        {
            yield return $"{controller.Name} must declare [ApiVersion].";
        }

        var route = attributes.FirstOrDefault(attribute => attribute.AttributeType.Name == "RouteAttribute");
        var template = route?.ConstructorArguments.FirstOrDefault().Value as string;
        if (template is null || !template.StartsWith(VersionedRoutePrefix, StringComparison.Ordinal))
        {
            yield return $"{controller.Name} must use a route starting with {VersionedRoutePrefix}.";
        }
    }

    private static bool InheritsFrom(Type type, string baseName)
    {
        for (var current = type.BaseType; current is not null; current = current.BaseType)
        {
            if (current.Name == baseName)
            {
                return true;
            }
        }

        return false;
    }

    private static class Samples
    {
        [AttributeUsage(AttributeTargets.Class)]
        public sealed class ApiVersionAttribute : Attribute;

        [AttributeUsage(AttributeTargets.Class)]
        public sealed class RouteAttribute(string template) : Attribute
        {
            public string Template { get; } = template;
        }

        public abstract class ApiControllerBase;

        [ApiVersion]
        [Route("api/v{version:apiVersion}/goods")]
        public sealed class GoodController : ApiControllerBase;

        [ApiVersion]
        [Route("api/v{version:apiVersion}/raw")]
        public sealed class NoEnvelopeController;

        [Route("api/v{version:apiVersion}/unversioned")]
        public sealed class NoVersionController : ApiControllerBase;

        [ApiVersion]
        [Route("api/plain")]
        public sealed class PlainRouteController : ApiControllerBase;
    }
}
