using ExeGroup.Group.Repositories;
using ExeGroup.Group.Services.Courses;
using ExeGroup.Group.Services.Events;
using ExeGroup.Group.Services.GroupTypes;
using ExeGroup.Group.Services.JoinRequests;
using ExeGroup.Group.Services.Majors;
using ExeGroup.Group.Services.Rooms;
using ExeGroup.Group.Services.Rosters;
using ExeGroup.Group.Services.Semesters;
using ExeGroup.Group.Services.Skills;
using ExeGroup.Group.Services.Subjects;
using ExeGroup.Group.Services.Suggestions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ExeGroup.Group.Services;

public static class DependencyInjection
{
    public static IServiceCollection AddGroupServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddGroupRepositories(configuration);
        services.AddScoped<IOutbox, Outbox>();
        services.AddScoped<IOutboxDispatcher, OutboxDispatcher>();
        services.AddScoped<ISemesterService, SemesterService>();
        services.AddScoped<ISubjectService, SubjectService>();
        services.AddScoped<IMajorService, MajorService>();
        services.AddScoped<ISkillService, SkillService>();
        services.AddScoped<IGroupTypeService, GroupTypeService>();
        services.AddScoped<ICourseService, CourseService>();
        services.AddScoped<ICoursePhaseService, CoursePhaseService>();
        services.AddScoped<IRosterService, RosterService>();
        services.AddScoped<IStudentProfileService, StudentProfileService>();
        services.AddScoped<RequestCloser>();
        services.AddScoped<RoomSeating>();
        services.AddScoped<IRoomService, RoomService>();
        services.AddScoped<IRoomMembershipService, RoomMembershipService>();
        services.AddScoped<IJoinRequestService, JoinRequestService>();
        services.AddScoped<ISuggestionService, SuggestionService>();
        RecommendationClient.Register(services, configuration);
        return services;
    }
}
