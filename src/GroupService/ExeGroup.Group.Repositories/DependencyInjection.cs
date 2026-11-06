using ExeGroup.BuildingBlocks.Data;
using ExeGroup.Group.Repositories.Data;
using ExeGroup.Group.Repositories.Interfaces;
using ExeGroup.Group.Repositories.Repositories;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.Group.Repositories;

public static class DependencyInjection
{
    public const string ConnectionName = "GroupDb";

    public static IServiceCollection AddGroupRepositories(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSqlServerDatabase<GroupDbContext>(configuration, ConnectionName);
        services.AddScoped<ISemesterRepository, SemesterRepository>();
        services.AddScoped<ISubjectRepository, SubjectRepository>();
        services.AddScoped<IMajorRepository, MajorRepository>();
        services.AddScoped<ISkillRepository, SkillRepository>();
        services.AddScoped<IGroupTypeRepository, GroupTypeRepository>();
        services.AddScoped<ICourseRepository, CourseRepository>();
        services.AddScoped<IRosterRepository, RosterRepository>();
        services.AddScoped<IOutboxRepository, OutboxRepository>();
        services.AddScoped<IRoomRepository, RoomRepository>();
        return services;
    }
}
