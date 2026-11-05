using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;

namespace ExeGroup.Group.Services.Majors;

public sealed record MajorModel(Guid Id, string Code, string Name);

public sealed record MajorInput(string Code, string Name);

public interface IMajorService
{
    Task<PagedResult<MajorModel>> ListAsync(ListQuery query, CancellationToken cancellationToken);

    Task<MajorModel> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<MajorModel> CreateAsync(MajorInput input, CancellationToken cancellationToken);

    Task<MajorModel> UpdateAsync(Guid id, MajorInput input, CancellationToken cancellationToken);

    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
}

public sealed class MajorService(IMajorRepository majors) : IMajorService
{
    public async Task<PagedResult<MajorModel>> ListAsync(ListQuery query, CancellationToken cancellationToken) =>
        (await majors.GetPageAsync(query, cancellationToken)).Map(ToModel);

    public async Task<MajorModel> GetAsync(Guid id, CancellationToken cancellationToken) =>
        ToModel(await RequireAsync(id, cancellationToken));

    public async Task<MajorModel> CreateAsync(MajorInput input, CancellationToken cancellationToken)
    {
        input = Normalize(input);
        await EnsureCodeIsFreeAsync(input.Code, null, cancellationToken);
        var major = new Major { MajorId = Guid.NewGuid(), Code = input.Code, Name = input.Name };
        majors.Add(major);
        await SaveAsync(input.Code, cancellationToken);
        return ToModel(major);
    }

    public async Task<MajorModel> UpdateAsync(Guid id, MajorInput input, CancellationToken cancellationToken)
    {
        input = Normalize(input);
        var major = await RequireAsync(id, cancellationToken);
        await EnsureCodeIsFreeAsync(input.Code, id, cancellationToken);
        major.Code = input.Code;
        major.Name = input.Name;
        await SaveAsync(input.Code, cancellationToken);
        return ToModel(major);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var major = await RequireAsync(id, cancellationToken);
        if (await majors.IsInUseAsync(id, cancellationToken))
        {
            throw new ConflictException(GroupErrorCodes.MajorInUse, $"Major '{major.Code}' is used by semester students or group types and cannot be deleted.");
        }

        majors.Remove(major);
        await majors.SaveChangesAsync(cancellationToken);
    }

    private async Task<Major> RequireAsync(Guid id, CancellationToken cancellationToken) =>
        await majors.FindAsync(id, cancellationToken) ?? throw new NotFoundException("Major", id);

    private async Task EnsureCodeIsFreeAsync(string code, Guid? exceptId, CancellationToken cancellationToken)
    {
        if (await majors.CodeExistsAsync(code, exceptId, cancellationToken))
        {
            throw CodeTaken(code);
        }
    }

    private async Task SaveAsync(string code, CancellationToken cancellationToken)
    {
        if (!await majors.TrySaveChangesAsync(cancellationToken))
        {
            throw CodeTaken(code);
        }
    }

    private static ConflictException CodeTaken(string code) =>
        new(GroupErrorCodes.MajorCodeTaken, $"Major code '{code}' is already used.");

    private static MajorInput Normalize(MajorInput input) =>
        input with { Code = input.Code.Trim().ToUpperInvariant(), Name = input.Name.Trim() };

    private static MajorModel ToModel(Major major) => new(major.MajorId, major.Code, major.Name);
}
