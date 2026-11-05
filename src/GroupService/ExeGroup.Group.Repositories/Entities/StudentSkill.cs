namespace ExeGroup.Group.Repositories.Entities;

public sealed class StudentSkill
{
    public Guid SemesterId { get; set; }

    public Guid StudentId { get; set; }

    public Guid SkillId { get; set; }

    public byte Level { get; set; }

    public DateTime UpdatedAt { get; set; }
}
