using System.ComponentModel.DataAnnotations;
using ExeGroup.Group.API.Validation;
using ExeGroup.Group.Services.Majors;

namespace ExeGroup.Group.API.Models.Majors;

public sealed class MajorRequest
{
    [Required]
    [StringLength(10, MinimumLength = 1)]
    [CatalogCode]
    public string? Code { get; init; }

    [Required]
    [StringLength(100, MinimumLength = 1)]
    public string? Name { get; init; }
}

public sealed record MajorResponse(Guid Id, string Code, string Name);

public static class MajorMappings
{
    public static MajorInput ToInput(this MajorRequest request) => new(request.Code!, request.Name!);

    public static MajorResponse ToResponse(this MajorModel model) => new(model.Id, model.Code, model.Name);
}
