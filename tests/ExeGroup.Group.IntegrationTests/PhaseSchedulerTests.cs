using System.Collections.Concurrent;
using ExeGroup.Group.API.Jobs;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Services.Courses;
using ExeGroup.Group.Services.Events;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace ExeGroup.Group.IntegrationTests;

public sealed class PhaseSchedulerFixture : GroupApiFixture
{
    public ConcurrentDictionary<Guid, bool> Broken { get; } = new();

    public PhaseScheduler Scheduler() => new(Api.Services.GetRequiredService<IServiceScopeFactory>(), NullLogger<PhaseScheduler>.Instance);

    protected override void ConfigureServices(IServiceCollection services)
    {
        services.AddScoped<CoursePhaseService>();
        services.AddScoped<ICoursePhaseService>(provider => new BreakablePhaseService(provider.GetRequiredService<CoursePhaseService>(), Broken));
    }

    private sealed class BreakablePhaseService(ICoursePhaseService inner, ConcurrentDictionary<Guid, bool> broken) : ICoursePhaseService
    {
        public Task<DuePhaseChanges> ListDueAsync(CancellationToken cancellationToken) => inner.ListDueAsync(cancellationToken);

        public Task<CourseModel> PublishAsync(Guid courseId, CancellationToken cancellationToken) =>
            broken.ContainsKey(courseId) ? throw new InvalidOperationException("Broken on purpose.") : inner.PublishAsync(courseId, cancellationToken);

        public Task<CourseModel> ExpireAsync(Guid courseId, CancellationToken cancellationToken) =>
            broken.ContainsKey(courseId) ? throw new InvalidOperationException("Broken on purpose.") : inner.ExpireAsync(courseId, cancellationToken);

        public Task<FinalizeResultModel> FinalizeAsync(Guid courseId, bool acceptExceptions, CancellationToken cancellationToken) =>
            inner.FinalizeAsync(courseId, acceptExceptions, cancellationToken);
    }
}

public sealed class PhaseSchedulerTests(PhaseSchedulerFixture fixture) : IClassFixture<PhaseSchedulerFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Due_courses_are_published_and_expired_one_by_one_and_a_failure_does_not_stop_the_rest()
    {
        var now = DateTime.UtcNow;
        var ids = new Dictionary<string, Guid>();
        Guid requestId = Guid.NewGuid();
        await fixture.SeedAsync(
            database =>
            {
                var semester = database.Semester();
                var subject = database.Subject();
                Course Add(string key, string phase, DateTime? publishAt, DateTime? expireAt)
                {
                    var course = database.Course(semester.SemesterId, subject.SubjectId);
                    (course.Phase, course.PublishAt, course.ExpireAt) = (phase, publishAt, expireAt);
                    ids[key] = course.CourseId;
                    return course;
                }

                Add("toPublish", CoursePhases.Setup, now.AddMinutes(-1), now.AddDays(1));
                Add("notYet", CoursePhases.Setup, now.AddHours(1), now.AddDays(1));
                Add("deadlinePassed", CoursePhases.Setup, now.AddHours(-2), now.AddHours(-1));
                Add("later", CoursePhases.Published, now.AddDays(-1), now.AddDays(1));
                Add("broken", CoursePhases.Published, now.AddDays(-1), now.AddMinutes(-1));
                var toExpire = Add("toExpire", CoursePhases.Published, now.AddDays(-1), now.AddMinutes(-1));
                var room = database.Room(toExpire, database.GroupType(semester.SemesterId).GroupTypeId, "Room 01");
                room.Status = RoomStatuses.Locked;
                var applicant = Guid.NewGuid();
                database.Enroll(toExpire, applicant);
                database.JoinRequests.Add(new JoinRequest { RequestId = requestId, RoomId = room.RoomId, CourseId = toExpire.CourseId, StudentId = applicant });
            },
            Ct);
        fixture.Broken[ids["broken"]] = true;
        var scheduler = fixture.Scheduler();

        var first = await scheduler.RunDueChangesAsync(Ct);
        var second = await scheduler.RunDueChangesAsync(Ct);

        Assert.Equal(new PhaseRun(1, 1, 1), first);
        Assert.Equal(new PhaseRun(0, 0, 1), second);
        var seeded = ids.Values.ToList();
        var phases = await fixture.QueryAsync(database => database.Courses.AsNoTracking()
            .Where(course => seeded.Contains(course.CourseId))
            .ToDictionaryAsync(course => course.CourseId, course => course.Phase, Ct));
        Assert.Equal(CoursePhases.Published, phases[ids["toPublish"]]);
        Assert.Equal(CoursePhases.Setup, phases[ids["notYet"]]);
        Assert.Equal(CoursePhases.Setup, phases[ids["deadlinePassed"]]);
        Assert.Equal(CoursePhases.Published, phases[ids["later"]]);
        Assert.Equal(CoursePhases.Published, phases[ids["broken"]]);
        Assert.Equal(CoursePhases.Expired, phases[ids["toExpire"]]);
        var request = await fixture.QueryAsync(database => database.JoinRequests.AsNoTracking().SingleAsync(item => item.RequestId == requestId, Ct));
        Assert.Equal((JoinRequestStatuses.Rejected, JoinRequestReasons.GroupingExpired), (request.Status, request.ReasonCode));
        var events = await fixture.QueryAsync(database => database.OutboxEvents.AsNoTracking()
            .Where(item => item.EventType == GroupEventTypes.CoursePhaseChanged)
            .Select(item => item.AggregateId)
            .ToListAsync(Ct));
        Assert.Equal(new[] { ids["toExpire"], ids["toPublish"] }.Order(), events.Order());
    }
}
