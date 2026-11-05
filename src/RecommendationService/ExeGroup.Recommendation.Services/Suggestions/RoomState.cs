namespace ExeGroup.Recommendation.Services.Suggestions;

internal sealed class RoomState
{
    private readonly RoomProfile _profile;
    private readonly List<StudentProfile> _members;

    public RoomState(RoomProfile profile)
    {
        _profile = profile;
        _members = [.. profile.Members];
    }

    public string RoomId => _profile.RoomId;

    public int MemberCount => _members.Count;

    public int MinGroupSize => _profile.MinGroupSize;

    public bool IsBelowMinimum => _members.Count < _profile.MinGroupSize;

    public void Add(StudentProfile student) => _members.Add(student);

    public bool Accepts(StudentProfile student)
    {
        if (_members.Count >= _profile.Capacity || _members.Any(member => member.StudentId == student.StudentId))
        {
            return false;
        }

        var majorsAfterJoin = MajorsWith(student);
        return SeatsStillNeeded(majorsAfterJoin) <= _profile.Capacity - majorsAfterJoin.Count;
    }

    public bool NeedsMajorOf(StudentProfile student) => SeatsStillNeeded(MajorsWith(student)) < SeatsStillNeeded(Majors());

    public IEnumerable<(string Skill, int Gap)> SkillGapsOf(StudentProfile student) =>
        student.Skills
            .Select(skill => (Skill: skill.Key, Gap: skill.Value - BestLevel(skill.Key)))
            .Where(skill => skill.Gap > 0)
            .OrderByDescending(skill => skill.Gap)
            .ThenBy(skill => skill.Skill, StringComparer.Ordinal);

    public int MissingSeatsFor(string majorCode) =>
        _profile.MinPerMajor.TryGetValue(majorCode, out var minimum)
            ? Math.Max(0, minimum - _members.Count(member => member.MajorCode == majorCode))
            : 0;

    private int BestLevel(string skill) =>
        _members.Select(member => member.Skills.GetValueOrDefault(skill)).DefaultIfEmpty(0).Max();

    private List<string> Majors() => [.. _members.Select(member => member.MajorCode)];

    private List<string> MajorsWith(StudentProfile student) => [.. Majors(), student.MajorCode];

    private int SeatsStillNeeded(List<string> majors)
    {
        var missingPerMajor = _profile.MinPerMajor.Sum(rule => Math.Max(0, rule.Value - majors.Count(major => major == rule.Key)));
        var present = majors.Where(major => major.Length > 0).ToHashSet(StringComparer.Ordinal);
        var addedByRules = _profile.MinPerMajor.Count(rule => rule.Value > 0 && !present.Contains(rule.Key));
        var missingMajors = Math.Max(0, _profile.MinDistinctMajors - present.Count - addedByRules);
        return missingPerMajor + missingMajors;
    }
}
