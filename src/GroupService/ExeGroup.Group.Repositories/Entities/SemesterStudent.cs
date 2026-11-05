namespace ExeGroup.Group.Repositories.Entities;

public sealed class SemesterStudent
{
    public Guid SemesterId { get; set; }

    public Guid StudentId { get; set; }

    public string StudentCode { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public Guid MajorId { get; set; }

    public DateTime AddedAt { get; set; }

    public ICollection<StudentSkill> Skills { get; } = [];
}
