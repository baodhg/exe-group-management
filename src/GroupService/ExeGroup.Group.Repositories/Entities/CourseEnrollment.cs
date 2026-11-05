namespace ExeGroup.Group.Repositories.Entities;

public sealed class CourseEnrollment
{
    public Guid CourseId { get; set; }

    public Guid StudentId { get; set; }

    public Guid SemesterId { get; set; }

    public DateTime EnrolledAt { get; set; }
}
