using ExeGroup.Group.Repositories.Interfaces;

namespace ExeGroup.Group.Services.Rooms;

public static class RoomComposition
{
    public static int SeatsStillNeeded(IReadOnlyCollection<Guid> majors, GroupTypeRules rules)
    {
        var missingPerMajor = rules.MinPerMajor.Sum(rule => Math.Max(0, rule.Value - majors.Count(major => major == rule.Key)));
        var present = majors.ToHashSet();
        var addedByRules = rules.MinPerMajor.Count(rule => rule.Value > 0 && !present.Contains(rule.Key));
        var missingMajors = Math.Max(0, rules.MinDistinctMajors - present.Count - addedByRules);
        return missingPerMajor + missingMajors;
    }

    public static bool CanAdd(int capacity, IReadOnlyCollection<Guid> majors, Guid major, GroupTypeRules rules)
    {
        List<Guid> after = [.. majors, major];
        return after.Count <= capacity && SeatsStillNeeded(after, rules) <= capacity - after.Count;
    }

    public static bool IsEligible(int minGroupSize, IReadOnlyCollection<Guid> majors, GroupTypeRules rules) =>
        majors.Count >= minGroupSize && SeatsStillNeeded(majors, rules) == 0;
}
