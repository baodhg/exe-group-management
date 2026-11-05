using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

namespace ExeGroup.Group.API.Validation;

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public sealed partial class CatalogCodeAttribute() : ValidationAttribute("A code uses letters, digits, '.', '_' or '-' and starts with a letter or digit.")
{
    public override bool IsValid(object? value) => value is not string code || Pattern().IsMatch(code.Trim());

    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9._-]*$")]
    private static partial Regex Pattern();
}
