using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using ExeGroup.Group.Services.Events;
using ExeGroup.Group.Services.Rooms;

namespace ExeGroup.Group.Services.Courses;

public sealed record DuePhaseChanges(IReadOnlyList<Guid> ToPublish, IReadOnlyList<Guid> ToExpire);

public sealed record FinalizeResultModel(CourseModel Course, int Groups, int DeletedRooms);

public interface ICoursePhaseService
{
    Task<DuePhaseChanges> ListDueAsync(CancellationToken cancellationToken);

    Task<CourseModel> PublishAsync(Guid courseId, CancellationToken cancellationToken);

    Task<CourseModel> ExpireAsync(Guid courseId, CancellationToken cancellationToken);

    Task<FinalizeResultModel> FinalizeAsync(Guid courseId, bool acceptExceptions, CancellationToken cancellationToken);
}

public sealed class CoursePhaseService(
    ICourseRepository courses,
    IRoomRepository rooms,
    RequestCloser requests,
    RoomSeating seating,
    IOutbox outbox,
    ITransactionRunner transactions,
    IClock clock) : ICoursePhaseService
{
    public async Task<DuePhaseChanges> ListDueAsync(CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        return new DuePhaseChanges(await courses.ListDueToPublishAsync(now, cancellationToken), await courses.ListDueToExpireAsync(now, cancellationToken));
    }

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

    public async Task<FinalizeResultModel> FinalizeAsync(Guid courseId, bool acceptExceptions, CancellationToken cancellationToken)
    {
        var (groups, deleted) = (0, 0);
        await ChangePhaseAsync(
            courseId,
            async (course, token) =>
            {
                (groups, deleted) = (0, 0);
                CourseProgressService.EnsureExpired(course);
                var overview = await CourseProgressService.BuildAsync(rooms, course, token);
                if (overview.Unplaced.Count > 0 || (overview.IneligibleRooms.Count > 0 && !acceptExceptions))
                {
                    throw new ConflictException(
                        GroupErrorCodes.FinalizeBlocked,
                        $"{overview.Unplaced.Count} students have no room and {overview.IneligibleRooms.Count} rooms are not eligible; place every student, and accept exceptions for the rooms.");
                }

                foreach (var room in await rooms.ListRoomsForUpdateAsync(course.CourseId, token))
                {
                    if (room.MemberCount == 0)
                    {
                        await rooms.RemoveWithHistoryAsync(room, token);
                        deleted++;
                        continue;
                    }

                    room.GroupNo = ++groups;
                    room.Status = RoomStatuses.Finalized;
                    seating.StatusChanged(room);
                }

                course.Phase = CoursePhases.Finalized;
                course.FinalizedAt = clock.UtcNow;
            },
            cancellationToken);
        return new FinalizeResultModel(await GetAsync(courseId, cancellationToken), groups, deleted);
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
