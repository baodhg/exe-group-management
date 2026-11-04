namespace ExeGroup.Group.Repositories.Entities;

public sealed class Semester
{
    public Guid SemesterId { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public DateOnly StartDate { get; set; }

    public DateOnly EndDate { get; set; }
}
