using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;

namespace ExeGroup.Group.Services.Rosters;

public sealed record SkillLevelModel(Guid SkillId, string SkillCode, string SkillName, byte Level, DateTime UpdatedAt);

public sealed record StudentProfileModel(
    Guid SemesterId,
    Guid StudentId,
    string StudentCode,
    string FullName,
    Guid MajorId,
    string MajorCode,
    string MajorName,
    bool SkillsLocked,
    IReadOnlyList<SkillLevelModel> Skills);

public sealed record SkillLevelInput(Guid SkillId, int Level);

public interface IStudentProfileService
{
    Task<StudentProfileModel> GetMineAsync(Guid semesterId, CancellationToken cancellationToken);

    Task<StudentProfileModel> RateMySkillsAsync(Guid semesterId, IReadOnlyList<SkillLevelInput> skills, CancellationToken cancellationToken);
}

public sealed class StudentProfileService(IRosterRepository rosters, ICurrentUser currentUser, IClock clock) : IStudentProfileService
{
    public const int MinLevel = 1;
    public const int MaxLevel = 5;

    public async Task<StudentProfileModel> GetMineAsync(Guid semesterId, CancellationToken cancellationToken) =>
        await ToModelAsync(await RequireMeAsync(semesterId, cancellationToken), cancellationToken);

    public async Task<StudentProfileModel> RateMySkillsAsync(Guid semesterId, IReadOnlyList<SkillLevelInput> skills, CancellationToken cancellationToken)
    {
        if (skills.Any(skill => skill.Level is < MinLevel or > MaxLevel))
        {
            throw new ValidationFailedException("level", $"A skill level is from {MinLevel} to {MaxLevel}.");
        }

        var duplicate = skills.GroupBy(skill => skill.SkillId).FirstOrDefault(group => group.Count() > 1);
        if (duplicate is not null)
        {
            throw new ValidationFailedException("skillId", $"Skill '{duplicate.Key}' is rated more than once.");
        }

        var student = await RequireMeAsync(semesterId, cancellationToken);
        if (await rosters.HasClosedCourseAsync(semesterId, student.StudentId, clock.UtcNow, cancellationToken))
        {
            throw new ConflictException(GroupErrorCodes.SkillsLocked, "Skills are locked once one of your courses has passed its grouping deadline.");
        }

        var known = await rosters.FindSkillsAsync(skills.Select(skill => skill.SkillId).ToList(), cancellationToken);
        var unknown = skills.FirstOrDefault(skill => !known.ContainsKey(skill.SkillId));
        if (unknown is not null)
        {
            throw new ValidationFailedException("skillId", $"Skill '{unknown.SkillId}' does not exist.");
        }

        var now = clock.UtcNow;
        var wanted = skills.ToDictionary(skill => skill.SkillId, skill => (byte)skill.Level);
        foreach (var rating in student.Skills.ToList())
        {
            if (wanted.Remove(rating.SkillId, out var level))
            {
                if (rating.Level != level)
                {
                    rating.Level = level;
                    rating.UpdatedAt = now;
                }
            }
            else
            {
                rosters.RemoveSkill(rating);
            }
        }

        foreach (var (skillId, level) in wanted)
        {
            student.Skills.Add(new StudentSkill { SemesterId = semesterId, StudentId = student.StudentId, SkillId = skillId, Level = level, UpdatedAt = now });
        }

        await rosters.SaveChangesAsync(cancellationToken);
        return await ToModelAsync(student, cancellationToken);
    }

    private async Task<SemesterStudent> RequireMeAsync(Guid semesterId, CancellationToken cancellationToken)
    {
        var studentId = currentUser.RequireUserId();
        return await rosters.FindWithSkillsAsync(semesterId, studentId, cancellationToken)
            ?? throw new NotFoundException("Semester student", studentId);
    }

    private async Task<StudentProfileModel> ToModelAsync(SemesterStudent student, CancellationToken cancellationToken)
    {
        var current = student.Skills.Where(skill => skill.SemesterId == student.SemesterId).ToList();
        var skills = await rosters.FindSkillsAsync(current.Select(skill => skill.SkillId).ToList(), cancellationToken);
        var major = await rosters.FindMajorAsync(student.MajorId, cancellationToken);
        var locked = await rosters.HasClosedCourseAsync(student.SemesterId, student.StudentId, clock.UtcNow, cancellationToken);
        return new StudentProfileModel(
            student.SemesterId,
            student.StudentId,
            student.StudentCode,
            student.FullName,
            student.MajorId,
            major?.Code ?? string.Empty,
            major?.Name ?? string.Empty,
            locked,
            current
                .Select(skill => new SkillLevelModel(skill.SkillId, skills[skill.SkillId].Code, skills[skill.SkillId].Name, skill.Level, skill.UpdatedAt))
                .OrderBy(skill => skill.SkillCode, StringComparer.Ordinal)
                .ToList());
    }
}
