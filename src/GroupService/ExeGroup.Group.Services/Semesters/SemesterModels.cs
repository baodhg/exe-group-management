namespace ExeGroup.Group.Services.Semesters;

public sealed record SemesterModel(Guid Id, string Code, string Name, DateOnly StartDate, DateOnly EndDate);

public sealed record SemesterInput(string Code, string Name, DateOnly StartDate, DateOnly EndDate);
