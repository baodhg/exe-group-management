namespace ExeGroup.Group.Repositories.Entities;

public sealed class Course
{
    public Guid CourseId { get; set; }

    public Guid SemesterId { get; set; }

    public Guid SubjectId { get; set; }

    public string ClassCode { get; set; } = string.Empty;

    public Guid? LecturerId { get; set; }

    public string? LecturerName { get; set; }

    public int MinGroupSize { get; set; } = 4;

    public int MaxGroupSize { get; set; } = 6;

    public decimal RoomFactor { get; set; } = 1.20m;

    public string Phase { get; set; } = CoursePhases.Setup;

    public DateTime? PublishAt { get; set; }

    public DateTime? ExpireAt { get; set; }

    public DateTime? FinalizedAt { get; set; }

    public byte[] RowVersion { get; set; } = [];
}

public static class CoursePhases
{
    public const string Setup = "Setup";
    public const string Published = "Published";
    public const string Expired = "Expired";
    public const string Finalized = "Finalized";
}
