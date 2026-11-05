using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;

namespace ExeGroup.Group.Services.Semesters;

public interface ISemesterService
{
    Task<PagedResult<SemesterModel>> ListAsync(ListQuery query, CancellationToken cancellationToken);

    Task<SemesterModel> GetAsync(Guid id, CancellationToken cancellationToken);

    Task<SemesterModel> CreateAsync(SemesterInput input, CancellationToken cancellationToken);

    Task<SemesterModel> UpdateAsync(Guid id, SemesterInput input, CancellationToken cancellationToken);

    Task DeleteAsync(Guid id, CancellationToken cancellationToken);
}

public sealed class SemesterService(ISemesterRepository semesters) : ISemesterService
{
    public async Task<PagedResult<SemesterModel>> ListAsync(ListQuery query, CancellationToken cancellationToken) =>
        (await semesters.GetPageAsync(query, cancellationToken)).Map(ToModel);

    public async Task<SemesterModel> GetAsync(Guid id, CancellationToken cancellationToken) =>
        ToModel(await RequireAsync(id, cancellationToken));

    public async Task<SemesterModel> CreateAsync(SemesterInput input, CancellationToken cancellationToken)
    {
        input = Normalize(input);
        await EnsureCodeIsFreeAsync(input.Code, null, cancellationToken);

        var semester = new Semester();
        Apply(semester, input);
        semesters.Add(semester);
        await SaveAsync(input.Code, cancellationToken);
        return ToModel(semester);
    }

    public async Task<SemesterModel> UpdateAsync(Guid id, SemesterInput input, CancellationToken cancellationToken)
    {
        input = Normalize(input);
        var semester = await RequireAsync(id, cancellationToken);
        await EnsureCodeIsFreeAsync(input.Code, id, cancellationToken);

        Apply(semester, input);
        await SaveAsync(input.Code, cancellationToken);
        return ToModel(semester);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var semester = await RequireAsync(id, cancellationToken);
        semesters.Remove(semester);
        await semesters.SaveChangesAsync(cancellationToken);
    }

    private async Task<Semester> RequireAsync(Guid id, CancellationToken cancellationToken) =>
        await semesters.FindAsync(id, cancellationToken) ?? throw new NotFoundException("Semester", id);

    private async Task EnsureCodeIsFreeAsync(string code, Guid? exceptId, CancellationToken cancellationToken)
    {
        if (await semesters.CodeExistsAsync(code, exceptId, cancellationToken))
        {
            throw CodeTaken(code);
        }
    }

    private async Task SaveAsync(string code, CancellationToken cancellationToken)
    {
        if (!await semesters.TrySaveChangesAsync(cancellationToken))
        {
            throw CodeTaken(code);
        }
    }

    private static ConflictException CodeTaken(string code) =>
        new(GroupErrorCodes.SemesterCodeTaken, $"Semester code '{code}' is already used.");

    private static SemesterInput Normalize(SemesterInput input) =>
        input with { Code = input.Code.Trim().ToUpperInvariant(), Name = input.Name.Trim() };

    private static void Apply(Semester semester, SemesterInput input)
    {
        semester.Code = input.Code;
        semester.Name = input.Name;
        semester.StartDate = input.StartDate;
        semester.EndDate = input.EndDate;
    }

    private static SemesterModel ToModel(Semester semester) =>
        new(semester.SemesterId, semester.Code, semester.Name, semester.StartDate, semester.EndDate);
}
