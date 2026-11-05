using System.ComponentModel.DataAnnotations;
using ExeGroup.Group.API.Validation;
using ExeGroup.Group.Services.Subjects;

namespace ExeGroup.Group.API.Models.Subjects;

public sealed class SubjectRequest
{
    [Required]
    [StringLength(20, MinimumLength = 1)]
    [CatalogCode]
    public string? Code { get; init; }

    [Required]
    [StringLength(150, MinimumLength = 1)]
    public string? Name { get; init; }
}

public sealed record SubjectResponse(Guid Id, string Code, string Name);

public static class SubjectMappings
{
    public static SubjectInput ToInput(this SubjectRequest request) => new(request.Code!, request.Name!);

    public static SubjectResponse ToResponse(this SubjectModel model) => new(model.Id, model.Code, model.Name);
}
