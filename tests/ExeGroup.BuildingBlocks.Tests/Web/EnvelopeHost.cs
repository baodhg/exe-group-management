using System.ComponentModel.DataAnnotations;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.BuildingBlocks.Web.Hosting;
using ExeGroup.BuildingBlocks.Web.Responses;
using FluentValidation;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.BuildingBlocks.Tests.Web;

public sealed class EnvelopeHost : IAsyncDisposable
{
    private readonly WebApplication _app;

    private EnvelopeHost(WebApplication app)
    {
        _app = app;
        Client = app.GetTestClient();
    }

    public HttpClient Client { get; }

    public static async Task<EnvelopeHost> StartAsync()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Services.AddApiDefaults(typeof(EnvelopeHost).Assembly);

        var app = builder.Build();
        app.UseApiDefaults();
        app.MapControllers();
        await app.StartAsync();
        return new EnvelopeHost(app);
    }

    public async ValueTask DisposeAsync() => await _app.DisposeAsync();
}

public sealed class ProbeRequest
{
    [Required]
    [StringLength(20)]
    public string? Name { get; init; }

    public int Members { get; init; }
}

public sealed class ProbeRequestValidator : AbstractValidator<ProbeRequest>
{
    public ProbeRequestValidator() => RuleFor(request => request.Members).InclusiveBetween(1, 10);
}

public sealed record ProbeResponse(string Code, string Name, int Members);

public sealed record SecretProbe(string Code, [property: System.Text.Json.Serialization.JsonIgnore] string Secret);

[Route("probe")]
public sealed class ProbeController : ApiControllerBase
{
    private static readonly ProbeResponse[] Items =
    [
        new("A", "Alpha", 3),
        new("B", "Beta", 5),
        new("C", "Gamma", 1),
    ];

    [HttpGet("ok")]
    public IActionResult GetOk() => Success(Items[0], "Probe loaded");

    [HttpGet("page")]
    public IActionResult GetPage([FromQuery] ListQueryRequest request)
    {
        var query = request.ToListQuery();
        var page = new PagedResult<ProbeResponse>(Items, query.Page, query.PageSize, Items.Length);
        return Paged(page, query, "Probes loaded");
    }

    [HttpPost]
    public IActionResult Create([FromBody] ProbeRequest request) =>
        Created("probe", new ProbeResponse("N", request.Name!, request.Members), "Probe created");

    [HttpGet("secrets")]
    public IActionResult GetSecrets([FromQuery] ListQueryRequest request)
    {
        var query = request.ToListQuery();
        return Paged(new PagedResult<SecretProbe>([new SecretProbe("S", "hash-123")], 1, 20, 1), query, "Secrets loaded");
    }

    [HttpGet("anonymous-only")]
    public IActionResult GetUnauthorized() => throw new UnauthorizedException();

    [HttpGet("conflict")]
    public IActionResult GetConflict() => throw new ConflictException("GROUP_FULL", "The group is full.");

    [HttpGet("missing")]
    public IActionResult GetMissing() => throw new NotFoundException("Probe", 42);

    [HttpGet("forbidden")]
    public IActionResult GetForbidden() => throw new ForbiddenException();

    [HttpGet("crash")]
    public IActionResult GetCrash() => throw new InvalidOperationException("secret connection string leaked");
}
