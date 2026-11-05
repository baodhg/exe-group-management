namespace ExeGroup.Group.Repositories.Entities;

public sealed class GroupType
{
    public Guid GroupTypeId { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public int MinDistinctMajors { get; set; } = 2;

    public ICollection<GroupTypeMajor> Majors { get; } = [];
}
