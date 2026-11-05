using ExeGroup.Recommendation.Services.Suggestions;

namespace ExeGroup.Recommendation.Tests;

internal static class Build
{
    public static StudentProfile Student(string id, string major, params (string Skill, int Level)[] skills) =>
        new(id, major, skills.ToDictionary(skill => skill.Skill, skill => skill.Level));

    public static RoomProfile Room(
        string id,
        int capacity = 5,
        StudentProfile[]? members = null,
        Dictionary<string, int>? minPerMajor = null,
        int minDistinctMajors = 0,
        int minGroupSize = 0) =>
        new(id, $"Room {id}", capacity, members ?? [], minPerMajor ?? [], minDistinctMajors, minGroupSize);

    public static Dictionary<string, int> AtLeast(string major, int count) => new() { [major] = count };
}
