using ExeGroup.Group.Services.Semesters;

namespace ExeGroup.Group.API.Models.Semesters;

public static class SemesterMappings
{
    public static SemesterInput ToInput(this SemesterRequest request) =>
        new(request.Code!, request.Name!, request.StartDate!.Value, request.EndDate!.Value);

    public static SemesterResponse ToResponse(this SemesterModel model) =>
        new(model.Id, model.Code, model.Name, model.StartDate, model.EndDate);
}
