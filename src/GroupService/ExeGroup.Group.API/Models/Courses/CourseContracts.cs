using System.ComponentModel.DataAnnotations;
using ExeGroup.Group.API.Validation;
using ExeGroup.Group.Services.Courses;

namespace ExeGroup.Group.API.Models.Courses;

public class CourseSettingsRequest
{
    [Required]
    [StringLength(30, MinimumLength = 1)]
    [CatalogCode]
    public string? ClassCode { get; init; }

    public Guid? LecturerId { get; init; }

    [StringLength(150)]
    public string? LecturerName { get; init; }

    [Required]
    [Range(1, 50)]
    public int? MinGroupSize { get; init; }

    [Required]
    [Range(1, 50)]
    public int? MaxGroupSize { get; init; }

    [Required]
    [Range(typeof(decimal), "1.00", "9.99")]
    public decimal? RoomFactor { get; init; }

    public DateTime? PublishAt { get; init; }

    public DateTime? ExpireAt { get; init; }
}

public sealed class CreateCourseRequest : CourseSettingsRequest
{
    [Required]
    public Guid? SemesterId { get; init; }

    [Required]
    public Guid? SubjectId { get; init; }
}

public sealed record CourseResponse(
    Guid Id,
    Guid SemesterId,
    string SemesterCode,
    Guid SubjectId,
    string SubjectCode,
    string SubjectName,
    string ClassCode,
    Guid? LecturerId,
    string? LecturerName,
    int MinGroupSize,
    int MaxGroupSize,
    decimal RoomFactor,
    string Phase,
    DateTime? PublishAt,
    DateTime? ExpireAt,
    DateTime? FinalizedAt,
    int StudentCount,
    int RoomCount);

public static class CourseMappings
{
    public static CourseSettings ToSettings(this CourseSettingsRequest request) =>
        new(
            request.ClassCode!,
            request.LecturerId,
            request.LecturerName,
            request.MinGroupSize!.Value,
            request.MaxGroupSize!.Value,
            request.RoomFactor!.Value,
            request.PublishAt,
            request.ExpireAt);

    public static CourseResponse ToResponse(this CourseModel model) =>
        new(
            model.Id,
            model.SemesterId,
            model.SemesterCode,
            model.SubjectId,
            model.SubjectCode,
            model.SubjectName,
            model.ClassCode,
            model.LecturerId,
            model.LecturerName,
            model.MinGroupSize,
            model.MaxGroupSize,
            model.RoomFactor,
            model.Phase,
            model.PublishAt,
            model.ExpireAt,
            model.FinalizedAt,
            model.StudentCount,
            model.RoomCount);
}
