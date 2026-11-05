using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;

namespace ExeGroup.Group.Services.GroupTypes;

public sealed record GroupTypeMajorModel(Guid MajorId, string MajorCode, string MajorName, int MinMembers);

public sealed record GroupTypeModel(Guid Id, string Code, string Name, int MinDistinctMajors, IReadOnlyList<GroupTypeMajorModel> Majors);

public sealed record GroupTypeInput(string Code, string Name, int MinDistinctMajors);

public sealed record MajorMinimum(Guid MajorId, int MinMembers);

public interface IGroupTypeService
{
    Task<PagedResult<GroupTypeModel>> ListAsync(ListQuery query, CancellationToken cancellationToken);

    Task<GroupTypeModel> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<GroupTypeModel> CreateAsync(GroupTypeInput input, CancellationToken cancellationToken);

    Task<GroupTypeModel> UpdateAsync(Guid id, GroupTypeInput input, CancellationToken cancellationToken);

    Task DeleteAsync(Guid id, CancellationToken cancellationToken);

    Task<GroupTypeModel> SetMajorsAsync(Guid id, IReadOnlyList<MajorMinimum> minimums, CancellationToken cancellationToken);

    Task<IReadOnlyList<GroupTypeModel>> ListForSemesterAsync(Guid semesterId, CancellationToken cancellationToken);

    Task<IReadOnlyList<GroupTypeModel>> SetForSemesterAsync(Guid semesterId, IReadOnlyList<Guid> groupTypeIds, CancellationToken cancellationToken);
}

public sealed class GroupTypeService(IGroupTypeRepository groupTypes, ISemesterRepository semesters) : IGroupTypeService
{
    public async Task<PagedResult<GroupTypeModel>> ListAsync(ListQuery query, CancellationToken cancellationToken)
    {
        var page = await groupTypes.GetPageAsync(query, cancellationToken);
        var majors = await MajorsOfAsync(page.Items, cancellationToken);
        return page.Map(groupType => ToModel(groupType, majors));
    }

    public async Task<GroupTypeModel> GetAsync(Guid id, CancellationToken cancellationToken) =>
        await ToModelAsync(await RequireAsync(id, cancellationToken), cancellationToken);

    public async Task<GroupTypeModel> CreateAsync(GroupTypeInput input, CancellationToken cancellationToken)
    {
        input = Normalize(input);
        await EnsureCodeIsFreeAsync(input.Code, null, cancellationToken);
        var groupType = new GroupType { GroupTypeId = Guid.NewGuid(), Code = input.Code, Name = input.Name, MinDistinctMajors = input.MinDistinctMajors };
        groupTypes.Add(groupType);
        await SaveAsync(input.Code, cancellationToken);
        return await ToModelAsync(groupType, cancellationToken);
    }

    public async Task<GroupTypeModel> UpdateAsync(Guid id, GroupTypeInput input, CancellationToken cancellationToken)
    {
        input = Normalize(input);
        var groupType = await RequireAsync(id, cancellationToken);
        await EnsureCodeIsFreeAsync(input.Code, id, cancellationToken);
        groupType.Code = input.Code;
        groupType.Name = input.Name;
        groupType.MinDistinctMajors = input.MinDistinctMajors;
        await SaveAsync(input.Code, cancellationToken);
        return await ToModelAsync(groupType, cancellationToken);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var groupType = await RequireAsync(id, cancellationToken);
        if (await groupTypes.IsUsedByRoomsAsync(id, cancellationToken))
        {
            throw InUse(groupType.Code);
        }

        foreach (var rule in groupType.Majors.ToList())
        {
            groupTypes.RemoveMajor(rule);
        }

        await groupTypes.RemoveAllSemesterLinksAsync(id, cancellationToken);
        groupTypes.Remove(groupType);
        await groupTypes.SaveChangesAsync(cancellationToken);
    }

    public async Task<GroupTypeModel> SetMajorsAsync(Guid id, IReadOnlyList<MajorMinimum> minimums, CancellationToken cancellationToken)
    {
        var groupType = await RequireAsync(id, cancellationToken);
        if (minimums.Any(minimum => minimum.MinMembers < 1))
        {
            throw new ValidationFailedException("majors", "Every major needs at least 1 member.");
        }

        var duplicate = minimums.GroupBy(minimum => minimum.MajorId).FirstOrDefault(group => group.Count() > 1);
        if (duplicate is not null)
        {
            throw new ValidationFailedException("majors", $"Major '{duplicate.Key}' is listed more than once.");
        }

        var known = await groupTypes.FindMajorsAsync(minimums.Select(minimum => minimum.MajorId).ToList(), cancellationToken);
        var missing = minimums.FirstOrDefault(minimum => !known.ContainsKey(minimum.MajorId));
        if (missing is not null)
        {
            throw new ValidationFailedException("majors", $"Major '{missing.MajorId}' does not exist.");
        }

        var wanted = minimums.ToDictionary(minimum => minimum.MajorId, minimum => minimum.MinMembers);
        foreach (var rule in groupType.Majors.ToList())
        {
            if (wanted.Remove(rule.MajorId, out var minMembers))
            {
                rule.MinMembers = minMembers;
            }
            else
            {
                groupTypes.RemoveMajor(rule);
            }
        }

        foreach (var (majorId, minMembers) in wanted)
        {
            groupType.Majors.Add(new GroupTypeMajor { GroupTypeId = id, MajorId = majorId, MinMembers = minMembers });
        }

        await groupTypes.SaveChangesAsync(cancellationToken);
        return await ToModelAsync(groupType, cancellationToken);
    }

    public async Task<IReadOnlyList<GroupTypeModel>> ListForSemesterAsync(Guid semesterId, CancellationToken cancellationToken)
    {
        await RequireSemesterAsync(semesterId, cancellationToken);
        var allowed = await groupTypes.ListAllowedInSemesterAsync(semesterId, cancellationToken);
        var majors = await MajorsOfAsync(allowed, cancellationToken);
        return allowed.Select(groupType => ToModel(groupType, majors)).ToList();
    }

    public async Task<IReadOnlyList<GroupTypeModel>> SetForSemesterAsync(Guid semesterId, IReadOnlyList<Guid> groupTypeIds, CancellationToken cancellationToken)
    {
        await RequireSemesterAsync(semesterId, cancellationToken);
        var wanted = groupTypeIds.Distinct().ToList();
        var existing = await groupTypes.FindExistingIdsAsync(wanted, cancellationToken);
        var unknown = wanted.Except(existing).FirstOrDefault();
        if (unknown != Guid.Empty)
        {
            throw new ValidationFailedException("groupTypeIds", $"Group type '{unknown}' does not exist.");
        }

        var links = await groupTypes.ListSemesterLinksAsync(semesterId, cancellationToken);
        var removed = links.Where(link => !wanted.Contains(link.GroupTypeId)).ToList();
        var used = await groupTypes.FindUsedByRoomsInSemesterAsync(semesterId, removed.Select(link => link.GroupTypeId).ToList(), cancellationToken);
        if (used.Count > 0)
        {
            throw new ConflictException(GroupErrorCodes.GroupTypeInUse, "Rooms of this semester still use a group type you are removing.");
        }

        foreach (var link in removed)
        {
            groupTypes.RemoveSemesterLink(link);
        }

        foreach (var groupTypeId in wanted.Where(id => links.All(link => link.GroupTypeId != id)))
        {
            groupTypes.AddSemesterLink(new SemesterGroupType { SemesterId = semesterId, GroupTypeId = groupTypeId });
        }

        await groupTypes.SaveChangesAsync(cancellationToken);
        return await ListForSemesterAsync(semesterId, cancellationToken);
    }

    private async Task<GroupType> RequireAsync(Guid id, CancellationToken cancellationToken) =>
        await groupTypes.FindAsync(id, cancellationToken) ?? throw new NotFoundException("Group type", id);

    private async Task RequireSemesterAsync(Guid semesterId, CancellationToken cancellationToken)
    {
        if (await semesters.FindAsync(semesterId, cancellationToken) is null)
        {
            throw new NotFoundException("Semester", semesterId);
        }
    }

    private async Task EnsureCodeIsFreeAsync(string code, Guid? exceptId, CancellationToken cancellationToken)
    {
        if (await groupTypes.CodeExistsAsync(code, exceptId, cancellationToken))
        {
            throw CodeTaken(code);
        }
    }

    private async Task SaveAsync(string code, CancellationToken cancellationToken)
    {
        if (!await groupTypes.TrySaveChangesAsync(cancellationToken))
        {
            throw CodeTaken(code);
        }
    }

    private async Task<GroupTypeModel> ToModelAsync(GroupType groupType, CancellationToken cancellationToken) =>
        ToModel(groupType, await MajorsOfAsync([groupType], cancellationToken));

    private Task<Dictionary<Guid, Major>> MajorsOfAsync(IEnumerable<GroupType> items, CancellationToken cancellationToken) =>
        groupTypes.FindMajorsAsync(items.SelectMany(groupType => groupType.Majors).Select(rule => rule.MajorId).Distinct().ToList(), cancellationToken);

    private static GroupTypeModel ToModel(GroupType groupType, Dictionary<Guid, Major> majors) =>
        new(
            groupType.GroupTypeId,
            groupType.Code,
            groupType.Name,
            groupType.MinDistinctMajors,
            groupType.Majors
                .Select(rule => new GroupTypeMajorModel(
                    rule.MajorId,
                    majors.TryGetValue(rule.MajorId, out var major) ? major.Code : string.Empty,
                    major?.Name ?? string.Empty,
                    rule.MinMembers))
                .OrderBy(rule => rule.MajorCode, StringComparer.Ordinal)
                .ToList());

    private static GroupTypeInput Normalize(GroupTypeInput input)
    {
        if (input.MinDistinctMajors < 1)
        {
            throw new ValidationFailedException("minDistinctMajors", "A group needs at least 1 major.");
        }

        return input with { Code = input.Code.Trim().ToUpperInvariant(), Name = input.Name.Trim() };
    }

    private static ConflictException CodeTaken(string code) =>
        new(GroupErrorCodes.GroupTypeCodeTaken, $"Group type code '{code}' is already used.");

    private static ConflictException InUse(string code) =>
        new(GroupErrorCodes.GroupTypeInUse, $"Group type '{code}' is used by rooms and cannot be deleted.");
}
