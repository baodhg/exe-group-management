using ExeGroup.Group.Repositories.Interfaces;

namespace ExeGroup.Group.Services.Rooms;

public sealed class RoomSummaries(IRoomRepository rooms)
{
    public async Task<List<RoomSummaryModel>> BuildAsync(IReadOnlyList<RoomRow> rows, CancellationToken cancellationToken)
    {
        if (rows.Count == 0)
        {
            return [];
        }

        var members = (await rooms.ListMemberMajorsAsync([.. rows.Select(row => row.Room.RoomId)], cancellationToken)).ToLookup(member => member.RoomId);
        var rules = new Dictionary<Guid, GroupTypeRules>();
        foreach (var groupTypeId in rows.Select(row => row.Room.GroupTypeId).Distinct())
        {
            rules[groupTypeId] = await rooms.GetRulesAsync(groupTypeId, cancellationToken);
        }

        return [.. rows.Select(row => Summarize(row, [.. members[row.Room.RoomId]], rules[row.Room.GroupTypeId]))];
    }

    private static RoomSummaryModel Summarize(RoomRow row, List<RoomMemberMajor> members, GroupTypeRules rule)
    {
        var codes = members.GroupBy(member => member.MajorId).ToDictionary(group => group.Key, group => group.First().MajorCode);
        foreach (var (majorId, code) in rule.MajorCodes)
        {
            codes.TryAdd(majorId, code);
        }

        List<Guid> majors = [.. members.Select(member => member.MajorId)];
        return RoomService.ToSummary(row) with
        {
            Majors =
            [
                .. codes
                    .Select(pair => new MajorCountModel(pair.Key, pair.Value, majors.Count(major => major == pair.Key), rule.MinPerMajor.GetValueOrDefault(pair.Key)))
                    .OrderByDescending(major => major.Members)
                    .ThenBy(major => major.MajorCode, StringComparer.Ordinal),
            ],
            MissingMajorSeats = RoomComposition.SeatsStillNeeded(majors, rule),
        };
    }
}
