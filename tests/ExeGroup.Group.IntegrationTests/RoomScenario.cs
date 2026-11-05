using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.IntegrationTests;

public sealed record RoomScenario(Guid CourseId, Guid SemesterId, Guid[] Rooms, Guid Se, Guid Ai, Guid LecturerId)
{
    public static async Task<RoomScenario> CreateAsync(
        GroupApiFixture fixture,
        IReadOnlyList<(Guid StudentId, bool Ai)> students,
        int capacity = 3,
        int rooms = 1,
        int aiRequired = 0,
        int minDistinctMajors = 1,
        string phase = CoursePhases.Published)
    {
        RoomScenario scenario = null!;
        await fixture.SeedAsync(
            database =>
            {
                var semester = database.Semester();
                var se = database.Major();
                var ai = database.Major();
                var course = database.Course(semester.SemesterId, database.Subject().SubjectId);
                course.Phase = phase;
                course.MinGroupSize = Math.Min(2, capacity);
                course.MaxGroupSize = capacity;
                course.LecturerId = Guid.NewGuid();
                course.LecturerName = "Dr. Lan";
                var groupType = database.GroupType(semester.SemesterId);
                groupType.MinDistinctMajors = minDistinctMajors;
                if (aiRequired > 0)
                {
                    database.GroupTypeMajors.Add(new GroupTypeMajor { GroupTypeId = groupType.GroupTypeId, MajorId = ai.MajorId, MinMembers = aiRequired });
                }

                var roomIds = Enumerable.Range(1, rooms)
                    .Select(index => database.Room(course, groupType.GroupTypeId, $"Room {index}", capacity).RoomId)
                    .ToArray();
                foreach (var (studentId, isAi) in students)
                {
                    database.Enroll(course, studentId, isAi ? ai.MajorId : se.MajorId);
                }

                scenario = new RoomScenario(course.CourseId, semester.SemesterId, roomIds, se.MajorId, ai.MajorId, course.LecturerId!.Value);
            },
            TestContext.Current.CancellationToken);
        return scenario;
    }

    public static HttpClient As(GroupApiFixture fixture, Guid studentId) => fixture.Api.ClientAs(Roles.Student, studentId);
}
