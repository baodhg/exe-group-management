using ExeGroup.Group.Repositories;
using ExeGroup.Group.Services.GroupTypes;
using ExeGroup.Group.Services.Majors;
using ExeGroup.Group.Services.Semesters;
using ExeGroup.Group.Services.Skills;
using ExeGroup.Group.Services.Subjects;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.Group.Services;

public static class DependencyInjection
{
    public static IServiceCollection AddGroupServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddGroupRepositories(configuration);
        services.AddScoped<ISemesterService, SemesterService>();
        services.AddScoped<ISubjectService, SubjectService>();
        services.AddScoped<IMajorService, MajorService>();
        services.AddScoped<ISkillService, SkillService>();
        services.AddScoped<IGroupTypeService, GroupTypeService>();
        return services;
    }
}
