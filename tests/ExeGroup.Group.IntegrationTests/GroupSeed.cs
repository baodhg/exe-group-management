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

    public static GroupType GroupType(this GroupDbContext database, Guid? allowedInSemesterId = null)
    {
        var groupType = new GroupType { GroupTypeId = Guid.NewGuid(), Code = Code("GT"), Name = "Seed group type", MinDistinctMajors = 1 };
        database.GroupTypes.Add(groupType);
        if (allowedInSemesterId is { } semesterId)
        {
            database.SemesterGroupTypes.Add(new SemesterGroupType { SemesterId = semesterId, GroupTypeId = groupType.GroupTypeId });
        }

        return groupType;
    }

    public static Room Room(this GroupDbContext database, Course course, Guid groupTypeId, string? name = null, int capacity = 5)
    {
        var room = new Room
        {
            RoomId = Guid.NewGuid(),
            CourseId = course.CourseId,
            SemesterId = course.SemesterId,
            GroupTypeId = groupTypeId,
            Name = name ?? Code("Room "),
            Capacity = capacity,
        };
        database.Rooms.Add(room);
        return room;
    }

    public static SemesterStudent Enroll(this GroupDbContext database, Course course, Guid studentId, Guid? majorId = null)
    {
        var student = database.Student(course.SemesterId, majorId ?? database.Major().MajorId, studentId);
        database.CourseEnrollments.Add(new CourseEnrollment { CourseId = course.CourseId, SemesterId = course.SemesterId, StudentId = studentId });
        return student;
    }

    public static RoomMember Join(this GroupDbContext database, Room room, Guid studentId, string joinedVia = JoinMethods.Open)
    {
        var member = new RoomMember
        {
            MembershipId = Guid.NewGuid(),
            RoomId = room.RoomId,
            CourseId = room.CourseId,
            StudentId = studentId,
            JoinedVia = joinedVia,
        };
        database.RoomMembers.Add(member);
        room.MemberCount++;
        room.LeaderId ??= studentId;
        return member;
    }

    public static JsonElement Data(this JsonElement body) => body.GetProperty("data");
}
