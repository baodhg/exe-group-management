namespace ExeGroup.BuildingBlocks.Context;

public static class Roles
{
    public const string Student = "Student";
    public const string Lecturer = "Lecturer";
    public const string Administrator = "Administrator";

    public static IReadOnlyList<string> All { get; } = [Student, Lecturer, Administrator];
}
