using System.Reflection;
using NetArchTest.Rules;

namespace ExeGroup.ArchitectureTests;

public sealed class LayeringTests
{
    private const string AspNetCore = "Microsoft.AspNetCore";
    private const string EntityFramework = "Microsoft.EntityFrameworkCore";
    private const string SharedWeb = "ExeGroup.BuildingBlocks.Web";

    public static TheoryData<string> Services => new() { "Identity", "Group", "Recommendation", "Realtime" };

    [Theory]
    [MemberData(nameof(Services))]
    public void Api_layer_never_touches_the_database_directly(string service)
    {
        AssertNoDependency(
            Layer(service, "API"),
            EntityFramework,
            $"ExeGroup.{service}.Repositories");
    }

    [Theory]
    [MemberData(nameof(Services))]
    public void Services_layer_stays_free_of_http_and_database_concerns(string service)
    {
        AssertNoDependency(
            Layer(service, "Services"),
            AspNetCore,
            EntityFramework,
            SharedWeb,
            $"ExeGroup.{service}.API");
    }

    [Theory]
    [MemberData(nameof(Services))]
    public void Repositories_layer_depends_on_nothing_above_it(string service)
    {
        AssertNoDependency(
            Layer(service, "Repositories"),
            AspNetCore,
            SharedWeb,
            $"ExeGroup.{service}.Services",
            $"ExeGroup.{service}.API");
    }

    [Theory]
    [MemberData(nameof(Services))]
    public void A_service_never_references_another_service(string service)
    {
        var others = Services.Select(row => row.Data).Where(other => other != service)
            .Select(other => $"ExeGroup.{other}.")
            .ToArray();

        foreach (var layer in new[] { "API", "Services", "Repositories" })
        {
            AssertNoDependency(Layer(service, layer), others);
        }
    }

    [Fact]
    public void Core_building_blocks_stay_free_of_http_concerns()
    {
        AssertNoDependency(Assembly.Load("ExeGroup.BuildingBlocks"), AspNetCore, SharedWeb);
    }

    private static Assembly Layer(string service, string layer) => Assembly.Load($"ExeGroup.{service}.{layer}");

    private static void AssertNoDependency(Assembly assembly, params string[] forbidden)
    {
        var result = Types.InAssembly(assembly)
            .Should()
            .NotHaveDependencyOnAny(forbidden)
            .GetResult();

        var offenders = result.FailingTypeNames ?? [];
        Assert.True(
            result.IsSuccessful,
            $"{assembly.GetName().Name} must not depend on [{string.Join(", ", forbidden)}]; offending types: {string.Join(", ", offenders)}");
    }
}
