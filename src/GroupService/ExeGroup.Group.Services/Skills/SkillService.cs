using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;

namespace ExeGroup.Group.Services.Skills;

public sealed record SkillModel(Guid Id, string Code, string Name);

public sealed record SkillInput(string Code, string Name);

public interface ISkillService
{
    Task<PagedResult<SkillModel>> ListAsync(ListQuery query, CancellationToken cancellationToken);

    Task<SkillModel> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<SkillModel> CreateAsync(SkillInput input, CancellationToken cancellationToken);

    Task<SkillModel> UpdateAsync(Guid id, SkillInput input, CancellationToken cancellationToken);

    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
}

public sealed class SkillService(ISkillRepository skills) : ISkillService
{
    public async Task<PagedResult<SkillModel>> ListAsync(ListQuery query, CancellationToken cancellationToken) =>
        (await skills.GetPageAsync(query, cancellationToken)).Map(ToModel);

    public async Task<SkillModel> GetAsync(Guid id, CancellationToken cancellationToken) =>
        ToModel(await RequireAsync(id, cancellationToken));

    public async Task<SkillModel> CreateAsync(SkillInput input, CancellationToken cancellationToken)
    {
        input = Normalize(input);
        await EnsureCodeIsFreeAsync(input.Code, null, cancellationToken);
        var skill = new Skill { SkillId = Guid.NewGuid(), Code = input.Code, Name = input.Name };
        skills.Add(skill);
        await SaveAsync(input.Code, cancellationToken);
        return ToModel(skill);
    }

    public async Task<SkillModel> UpdateAsync(Guid id, SkillInput input, CancellationToken cancellationToken)
    {
        input = Normalize(input);
        var skill = await RequireAsync(id, cancellationToken);
        await EnsureCodeIsFreeAsync(input.Code, id, cancellationToken);
        skill.Code = input.Code;
        skill.Name = input.Name;
        await SaveAsync(input.Code, cancellationToken);
        return ToModel(skill);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var skill = await RequireAsync(id, cancellationToken);
        if (await skills.IsInUseAsync(id, cancellationToken))
        {
            throw new ConflictException(GroupErrorCodes.SkillInUse, $"Skill '{skill.Code}' is used by student ratings and cannot be deleted.");
        }

        skills.Remove(skill);
        await skills.SaveChangesAsync(cancellationToken);
    }

    private async Task<Skill> RequireAsync(Guid id, CancellationToken cancellationToken) =>
        await skills.FindAsync(id, cancellationToken) ?? throw new NotFoundException("Skill", id);

    private async Task EnsureCodeIsFreeAsync(string code, Guid? exceptId, CancellationToken cancellationToken)
    {
        if (await skills.CodeExistsAsync(code, exceptId, cancellationToken))
        {
            throw CodeTaken(code);
        }
    }

    private async Task SaveAsync(string code, CancellationToken cancellationToken)
    {
        if (!await skills.TrySaveChangesAsync(cancellationToken))
        {
            throw CodeTaken(code);
        }
    }

    private static ConflictException CodeTaken(string code) =>
        new(GroupErrorCodes.SkillCodeTaken, $"Skill code '{code}' is already used.");

    private static SkillInput Normalize(SkillInput input) =>
        input with { Code = input.Code.Trim().ToUpperInvariant(), Name = input.Name.Trim() };

    private static SkillModel ToModel(Skill skill) => new(skill.SkillId, skill.Code, skill.Name);
}
