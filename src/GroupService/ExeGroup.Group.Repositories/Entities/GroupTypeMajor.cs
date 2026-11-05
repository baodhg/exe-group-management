namespace ExeGroup.Group.Repositories.Entities;

public sealed class GroupTypeMajor
{
    public Guid GroupTypeId { get; set; }

    public Guid MajorId { get; set; }

    public int MinMembers { get; set; }
}
