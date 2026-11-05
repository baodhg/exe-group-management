namespace ExeGroup.Group.Repositories.Entities;

public sealed class Subject
{
    public Guid SubjectId { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
}
