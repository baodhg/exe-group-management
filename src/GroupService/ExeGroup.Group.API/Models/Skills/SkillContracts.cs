using System.ComponentModel.DataAnnotations;
using ExeGroup.Group.API.Validation;
using ExeGroup.Group.Services.Skills;

namespace ExeGroup.Group.API.Models.Skills;

public sealed class SkillRequest
{
    [Required]
    [StringLength(20, MinimumLength = 1)]
    [CatalogCode]
    public string? Code { get; init; }

    [Required]
    [StringLength(100, MinimumLength = 1)]
    public string? Name { get; init; }
}

public sealed record SkillResponse(Guid Id, string Code, string Name);

public static class SkillMappings
{
    public static SkillInput ToInput(this SkillRequest request) => new(request.Code!, request.Name!);

    public static SkillResponse ToResponse(this SkillModel model) => new(model.Id, model.Code, model.Name);
}
