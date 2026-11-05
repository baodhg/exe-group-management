using System.Text.Json;
using ExeGroup.Group.Repositories.Data;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.IntegrationTests;

public static class GroupSeed
{
    public static string Code(string prefix) => $"{prefix}{Random.Shared.Next(10000, 99999)}";

    public static Semester Semester(this GroupDbContext database)
    {
        var semester = new Semester
        {
            SemesterId = Guid.NewGuid(),
            Code = $"S{Guid.NewGuid():N}"[..20],
            Name = "Seed semester",
            StartDate = new DateOnly(2026, 5, 1),
            EndDate = new DateOnly(2026, 8, 31),
        };
        database.Semesters.Add(semester);
        return semester;
    }

    public static Subject Subject(this GroupDbContext database)
    {
        var subject = new Subject { SubjectId = Guid.NewGuid(), Code = Code("SUB"), Name = "Seed subject" };
        database.Subjects.Add(subject);
        return subject;
    }

    public static Major Major(this GroupDbContext database)
    {
        var major = new Major { MajorId = Guid.NewGuid(), Code = Code("M"), Name = "Seed major" };
        database.Majors.Add(major);
        return major;
    }

    public static Skill Skill(this GroupDbContext database)
    {
        var skill = new Skill { SkillId = Guid.NewGuid(), Code = Code("SK"), Name = "Seed skill" };
        database.Skills.Add(skill);
        return skill;
    }

    public static Course Course(this GroupDbContext database, Guid semesterId, Guid subjectId, string? classCode = null)
    {
        var course = new Course
        {
            CourseId = Guid.NewGuid(),
            SemesterId = semesterId,
            SubjectId = subjectId,
            ClassCode = classCode ?? Code("SE"),
        };
        database.Courses.Add(course);
        return course;
    }

    public static SemesterStudent Student(this GroupDbContext database, Guid semesterId, Guid majorId, Guid? studentId = null)
    {
        var id = studentId ?? Guid.NewGuid();
        var student = new SemesterStudent
        {
            SemesterId = semesterId,
            StudentId = id,
            StudentCode = Code("SE"),
            FullName = "Seed Student",
            Email = $"{id:N}@fpt.edu.vn",
            MajorId = majorId,
        };
        database.SemesterStudents.Add(student);
        return student;
    }

    public static JsonElement Data(this JsonElement body) => body.GetProperty("data");
}
