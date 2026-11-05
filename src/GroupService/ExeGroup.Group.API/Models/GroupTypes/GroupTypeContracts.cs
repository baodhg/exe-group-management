using System.ComponentModel.DataAnnotations;
using ExeGroup.Group.API.Validation;
using ExeGroup.Group.Services.GroupTypes;

namespace ExeGroup.Group.API.Models.GroupTypes;

public sealed class GroupTypeRequest
{
    [Required]
    [StringLength(20, MinimumLength = 1)]
    [CatalogCode]
    public string? Code { get; init; }

    [Required]
    [StringLength(100, MinimumLength = 1)]
    public string? Name { get; init; }

    [Required]
    [Range(1, 20)]
    public int? MinDistinctMajors { get; init; }
}

public sealed class MajorMinimumRequest
{
    [Required]
    public Guid? MajorId { get; init; }

    [Required]
    [Range(1, 20)]
    public int? MinMembers { get; init; }
}

public sealed class SemesterGroupTypesRequest
{
    [Required]
    public List<Guid>? GroupTypeIds { get; init; }
}

public sealed record GroupTypeMajorResponse(Guid MajorId, string MajorCode, string MajorName, int MinMembers);

public sealed record GroupTypeResponse(Guid Id, string Code, string Name, int MinDistinctMajors, IReadOnlyList<GroupTypeMajorResponse> Majors);

public static class GroupTypeMappings
{
    public static GroupTypeInput ToInput(this GroupTypeRequest request) => new(request.Code!, request.Name!, request.MinDistinctMajors!.Value);

    public static MajorMinimum ToInput(this MajorMinimumRequest request) => new(request.MajorId!.Value, request.MinMembers!.Value);

    public static GroupTypeResponse ToResponse(this GroupTypeModel model) =>
        new(
            model.Id,
            model.Code,
            model.Name,
            model.MinDistinctMajors,
            model.Majors.Select(major => new GroupTypeMajorResponse(major.MajorId, major.MajorCode, major.MajorName, major.MinMembers)).ToList());
}
