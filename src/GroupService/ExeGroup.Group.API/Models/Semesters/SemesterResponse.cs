namespace ExeGroup.Group.API.Models.Semesters;

public sealed record SemesterResponse(Guid Id, string Code, string Name, DateOnly StartDate, DateOnly EndDate);
