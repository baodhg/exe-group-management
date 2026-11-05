namespace ExeGroup.Group.Repositories.Entities;

public sealed class Skill
{
    public Guid SkillId { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
}
