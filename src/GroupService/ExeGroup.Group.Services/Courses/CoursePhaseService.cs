using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using ExeGroup.Group.Services.Events;
using ExeGroup.Group.Services.Rooms;

namespace ExeGroup.Group.Services.Courses;

public interface ICoursePhaseService
{
    Task<CourseModel> PublishAsync(Guid courseId, CancellationToken cancellationToken);

    Task<CourseModel> ExpireAsync(Guid courseId, CancellationToken cancellationToken);
}

public sealed class CoursePhaseService(
    ICourseRepository courses,
    IRoomRepository rooms,
    RequestCloser requests,
    IOutbox outbox,
    ITransactionRunner transactions,
    IClock clock) : ICoursePhaseService
{
    public async Task<CourseModel> PublishAsync(Guid courseId, CancellationToken cancellationToken)
    {
        await ChangePhaseAsync(
            courseId,
            (course, _) =>
            {
                if (course.Phase != CoursePhases.Setup)
                {
                    throw new ConflictException(GroupErrorCodes.CourseNotInSetup, $"Only a course in Setup can be published; this one is {course.Phase}.");
                }

                if (course.ExpireAt is { } expireAt && expireAt <= clock.UtcNow)
                {
                    throw new ValidationFailedException("expireAt", "The deadline has passed; move it later before publishing.");
                }

                course.Phase = CoursePhases.Published;
                return Task.CompletedTask;
            },
            cancellationToken);
        return await GetAsync(courseId, cancellationToken);
    }

    public async Task<CourseModel> ExpireAsync(Guid courseId, CancellationToken cancellationToken)
    {
        await ChangePhaseAsync(
            courseId,
            async (course, token) =>
            {
                if (course.Phase != CoursePhases.Published)
                {
                    throw new ConflictException(GroupErrorCodes.CourseNotPublished, $"Only a published course can expire; this one is {course.Phase}.");
                }

                course.Phase = CoursePhases.Expired;
                await requests.CloseAsync(await rooms.ListPendingForCourseAsync(course.CourseId, token), JoinRequestReasons.GroupingExpired, null, token);
            },
            cancellationToken);
        return await GetAsync(courseId, cancellationToken);
    }

    private async Task ChangePhaseAsync(Guid courseId, Func<Course, CancellationToken, Task> change, CancellationToken cancellationToken) =>
        await transactions.ExecuteWithConflictRetryAsync(
            async token =>
            {
                var course = await courses.FindAsync(courseId, token) ?? throw new NotFoundException("Course", courseId);
                var row = await courses.FindRowAsync(courseId, token) ?? throw new NotFoundException("Course", courseId);
                await change(course, token);
                outbox.Enqueue(
                    GroupEventTypes.CoursePhaseChanged,
                    course.CourseId,
                    new CoursePhaseChangedEvent(
                        course.CourseId,
                        $"{row.SubjectCode} {course.ClassCode}",
                        course.Phase,
                        course.LecturerId,
                        await rooms.ListEnrolledIdsAsync(course.CourseId, token)));
                await courses.SaveChangesAsync(token);
                return true;
            },
            cancellationToken);

    private async Task<CourseModel> GetAsync(Guid courseId, CancellationToken cancellationToken) =>
        CourseService.ToModel(await courses.FindRowAsync(courseId, cancellationToken) ?? throw new NotFoundException("Course", courseId));
}
