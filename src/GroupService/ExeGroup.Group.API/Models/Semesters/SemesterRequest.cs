using System.ComponentModel.DataAnnotations;
using ExeGroup.Group.API.Validation;
using FluentValidation;

namespace ExeGroup.Group.API.Models.Semesters;

public sealed class SemesterRequest
{
    [Required]
    [SemesterCode]
    public string? Code { get; init; }

    [Required]
    [StringLength(100, MinimumLength = 1)]
    public string? Name { get; init; }

    [Required]
    public DateOnly? StartDate { get; init; }

    [Required]
    public DateOnly? EndDate { get; init; }
}

public sealed class SemesterRequestValidator : AbstractValidator<SemesterRequest>
{
    public SemesterRequestValidator()
    {
        RuleFor(request => request.EndDate)
            .GreaterThan(request => request.StartDate)
            .When(request => request.StartDate is not null && request.EndDate is not null)
            .WithMessage("End date must be after the start date.");
    }
}
