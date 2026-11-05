using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;

namespace ExeGroup.Group.Services.Subjects;

public sealed record SubjectModel(Guid Id, string Code, string Name);

public sealed record SubjectInput(string Code, string Name);

public interface ISubjectService
{
    Task<PagedResult<SubjectModel>> ListAsync(ListQuery query, CancellationToken cancellationToken);

    Task<SubjectModel> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<SubjectModel> CreateAsync(SubjectInput input, CancellationToken cancellationToken);

    Task<SubjectModel> UpdateAsync(Guid id, SubjectInput input, CancellationToken cancellationToken);

    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
}

public sealed class SubjectService(ISubjectRepository subjects) : ISubjectService
{
    public async Task<PagedResult<SubjectModel>> ListAsync(ListQuery query, CancellationToken cancellationToken) =>
        (await subjects.GetPageAsync(query, cancellationToken)).Map(ToModel);

    public async Task<SubjectModel> GetAsync(Guid id, CancellationToken cancellationToken) =>
        ToModel(await RequireAsync(id, cancellationToken));

    public async Task<SubjectModel> CreateAsync(SubjectInput input, CancellationToken cancellationToken)
    {
        input = Normalize(input);
        await EnsureCodeIsFreeAsync(input.Code, null, cancellationToken);
        var subject = new Subject { SubjectId = Guid.NewGuid(), Code = input.Code, Name = input.Name };
        subjects.Add(subject);
        await SaveAsync(input.Code, cancellationToken);
        return ToModel(subject);
    }

    public async Task<SubjectModel> UpdateAsync(Guid id, SubjectInput input, CancellationToken cancellationToken)
    {
        input = Normalize(input);
        var subject = await RequireAsync(id, cancellationToken);
        await EnsureCodeIsFreeAsync(input.Code, id, cancellationToken);
        subject.Code = input.Code;
        subject.Name = input.Name;
        await SaveAsync(input.Code, cancellationToken);
        return ToModel(subject);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var subject = await RequireAsync(id, cancellationToken);
        if (await subjects.IsInUseAsync(id, cancellationToken))
        {
            throw new ConflictException(GroupErrorCodes.SubjectInUse, $"Subject '{subject.Code}' is used by courses and cannot be deleted.");
        }

        subjects.Remove(subject);
        await subjects.SaveChangesAsync(cancellationToken);
    }

    private async Task<Subject> RequireAsync(Guid id, CancellationToken cancellationToken) =>
        await subjects.FindAsync(id, cancellationToken) ?? throw new NotFoundException("Subject", id);

    private async Task EnsureCodeIsFreeAsync(string code, Guid? exceptId, CancellationToken cancellationToken)
    {
        if (await subjects.CodeExistsAsync(code, exceptId, cancellationToken))
        {
            throw CodeTaken(code);
        }
    }

    private async Task SaveAsync(string code, CancellationToken cancellationToken)
    {
        if (!await subjects.TrySaveChangesAsync(cancellationToken))
        {
            throw CodeTaken(code);
        }
    }

    private static ConflictException CodeTaken(string code) =>
        new(GroupErrorCodes.SubjectCodeTaken, $"Subject code '{code}' is already used.");

    private static SubjectInput Normalize(SubjectInput input) =>
        input with { Code = input.Code.Trim().ToUpperInvariant(), Name = input.Name.Trim() };

    private static SubjectModel ToModel(Subject subject) => new(subject.SubjectId, subject.Code, subject.Name);
}
