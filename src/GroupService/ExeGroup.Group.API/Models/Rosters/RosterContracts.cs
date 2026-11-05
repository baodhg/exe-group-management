using System.ComponentModel.DataAnnotations;
using ExeGroup.Group.Services.Rosters;

namespace ExeGroup.Group.API.Models.Rosters;

public sealed class SemesterStudentItem
{
    [Required]
    public Guid? StudentId { get; init; }

    [Required]
    [StringLength(20, MinimumLength = 1)]
    public string? StudentCode { get; init; }

    [Required]
    [StringLength(150, MinimumLength = 1)]
    public string? FullName { get; init; }

    [Required]
    [EmailAddress]
    [StringLength(255)]
    public string? Email { get; init; }

    [Required]
    public Guid? MajorId { get; init; }
}

public sealed class SemesterStudentsRequest
{
    [Required]
    [MinLength(1)]
    [MaxLength(1000)]
    public List<SemesterStudentItem>? Students { get; init; }
}

public sealed class EnrollStudentsRequest
{
    [Required]
    [MinLength(1)]
    [MaxLength(1000)]
    public List<Guid>? StudentIds { get; init; }
}

public sealed record SemesterStudentResponse(
    Guid StudentId,
    string StudentCode,
    string FullName,
    string Email,
    Guid MajorId,
    string MajorCode,
    string MajorName,
    DateTime AddedAt,
    int CourseCount);

public sealed record SemesterStudentsSavedResponse(int Added, int Updated);

public sealed record RosterEntryResponse(
    Guid StudentId,
    string StudentCode,
    string FullName,
    string Email,
    Guid MajorId,
    string MajorCode,
    DateTime EnrolledAt,
    Guid? RoomId,
    string? RoomName);

public sealed record EnrollmentResponse(int Enrolled, int AlreadyEnrolled);

public static class RosterMappings
{
    public static SemesterStudentInput ToInput(this SemesterStudentItem item) =>
        new(item.StudentId!.Value, item.StudentCode!, item.FullName!, item.Email!, item.MajorId!.Value);

    public static SemesterStudentResponse ToResponse(this SemesterStudentModel model) =>
        new(model.StudentId, model.StudentCode, model.FullName, model.Email, model.MajorId, model.MajorCode, model.MajorName, model.AddedAt, model.CourseCount);

    public static RosterEntryResponse ToResponse(this RosterEntryModel model) =>
        new(model.StudentId, model.StudentCode, model.FullName, model.Email, model.MajorId, model.MajorCode, model.EnrolledAt, model.RoomId, model.RoomName);
}
