using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

namespace ExeGroup.Group.API.Validation;

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public sealed partial class SemesterCodeAttribute() : ValidationAttribute("Semester code must look like SP26, SU26 or FA26.")
{
    public override bool IsValid(object? value) => value is not string code || Pattern().IsMatch(code.Trim());

    [GeneratedRegex("^(SP|SU|FA)[0-9]{2}$", RegexOptions.IgnoreCase)]
    private static partial Regex Pattern();
}
