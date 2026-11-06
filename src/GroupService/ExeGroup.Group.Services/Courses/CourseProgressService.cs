using ExeGroup.BuildingBlocks.Context;
using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Errors;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using ExeGroup.Group.Services.Rooms;
using ExeGroup.Group.Services.Suggestions;

namespace ExeGroup.Group.Services.Courses;

public sealed record OverviewRoomModel(RoomSummaryModel Room, int MissingMembers, int MissingMajorSeats, IReadOnlyList<MajorCountModel> Majors);

public sealed record CourseOverviewModel(
    Guid CourseId,
    string Phase,
    DateTime? ExpireAt,
    DateTime? FinalizedAt,
    int MinGroupSize,
    int StudentCount,
    int PlacedCount,
    int RoomCount,
    int EmptyRoomCount,
    int EligibleRoomCount,
    IReadOnlyList<StudentRefModel> Unplaced,
    IReadOnlyList<OverviewRoomModel> IneligibleRooms);

public sealed record PlacementRequest(Guid StudentId, Guid RoomId);

public interface ICourseProgressService
{
    Task<CourseOverviewModel> GetOverviewAsync(Guid courseId, CancellationToken cancellationToken);

    Task<CourseOverviewModel> PlaceAsync(Guid courseId, IReadOnlyList<PlacementRequest> placements, CancellationToken cancellationToken);
}

public sealed class CourseProgressService(
    IRoomRepository rooms,
    RoomSeating seating,
    ITransactionRunner transactions,
    ICurrentUser currentUser) : ICourseProgressService
{
    public const int MaxPlacements = 500;

    public async Task<CourseOverviewModel> GetOverviewAsync(Guid courseId, CancellationToken cancellationToken)
    {
        var course = await rooms.FindCourseAsync(courseId, cancellationToken) ?? throw new NotFoundException("Course", courseId);
        if (!currentUser.IsInRole(Roles.Administrator) && course.LecturerId != currentUser.RequireUserId())
        {
            throw new ForbiddenException("Only administrators and the course's lecturer can see its overview.");
        }

        return await BuildAsync(rooms, course, cancellationToken);
    }

    public async Task<CourseOverviewModel> PlaceAsync(Guid courseId, IReadOnlyList<PlacementRequest> placements, CancellationToken cancellationToken)
    {
        if (placements.Count is 0 or > MaxPlacements)
        {
            throw new ValidationFailedException("placements", $"Send 1 to {MaxPlacements} placements.");
        }

        if (placements.GroupBy(placement => placement.StudentId).Any(group => group.Count() > 1))
        {
            throw new ValidationFailedException("placements", "Place each student once per request.");
        }

        var adminId = currentUser.RequireUserId();
        await transactions.ExecuteWithConflictRetryAsync(
            async token =>
            {
                var course = await rooms.FindCourseAsync(courseId, token) ?? throw new NotFoundException("Course", courseId);
                EnsureExpired(course);
                var courseRooms = (await rooms.ListRoomsForUpdateAsync(courseId, token)).ToDictionary(room => room.RoomId);
                var memberships = await rooms.ListCourseMembershipsAsync(courseId, token);
                var enrolled = (await rooms.ListEnrolledIdsAsync(courseId, token)).ToHashSet();
                for (var index = 0; index < placements.Count; index++)
                {
                    if (!courseRooms.ContainsKey(placements[index].RoomId))
                    {
                        throw new ValidationFailedException($"placements[{index}].roomId", "The room is not in this course.");
                    }

                    if (!enrolled.Contains(placements[index].StudentId))
                    {
                        throw RoomSeating.Conflict(GroupErrorCodes.NotEnrolled, $"Student {placements[index].StudentId} is not on the course roster.");
                    }
                }

                var current = memberships.ToDictionary(member => member.StudentId);
                var moves = placements.Where(placement => current.GetValueOrDefault(placement.StudentId)?.RoomId != placement.RoomId).ToList();
                foreach (var move in moves)
                {
                    if (current.GetValueOrDefault(move.StudentId) is { } membership)
                    {
                        var from = courseRooms[membership.RoomId];
                        var roommates = memberships.Where(member => member.RoomId == from.RoomId).ToList();
                        await seating.EndMembershipAsync(from, roommates, membership, MembershipEndReasons.Moved, null, adminId, token);
                    }
                }

                await rooms.SaveChangesAsync(token);
                foreach (var target in moves.GroupBy(move => move.RoomId))
                {
                    var room = courseRooms[target.Key];
                    if (room.MemberCount + target.Count() > room.Capacity)
                    {
                        throw RoomSeating.Conflict(GroupErrorCodes.RoomFull, $"{room.Name} has {room.Capacity - room.MemberCount} free seats for {target.Count()} students.");
                    }

                    foreach (var move in target)
                    {
                        seating.Seat(room, move.StudentId, JoinMethods.Admin);
                    }
                }

                await rooms.SaveChangesAsync(token);
                return true;
            },
            cancellationToken);
        var updated = await rooms.FindCourseAsync(courseId, cancellationToken) ?? throw new NotFoundException("Course", courseId);
        return await BuildAsync(rooms, updated, cancellationToken);
    }

    internal static void EnsureExpired(Course course)
    {
        if (course.Phase == CoursePhases.Finalized)
        {
            throw new ConflictException(GroupErrorCodes.CourseFinalized, "The course is finalized; its groups are official.");
        }

        if (course.Phase != CoursePhases.Expired)
        {
            throw new ConflictException(GroupErrorCodes.CourseNotExpired, "The admin places students only after the course expired.");
        }
    }

    internal static async Task<CourseOverviewModel> BuildAsync(IRoomRepository rooms, Course course, CancellationToken cancellationToken)
    {
        var students = await rooms.ListCourseStudentsAsync(course, cancellationToken);
        var rows = await rooms.ListRowsAsync(course.CourseId, cancellationToken);
        var rules = new Dictionary<Guid, GroupTypeRules>();
        foreach (var groupTypeId in rows.Select(row => row.Room.GroupTypeId).Distinct())
        {
            rules[groupTypeId] = await rooms.GetRulesAsync(groupTypeId, cancellationToken);
        }

        var members = students.Where(student => student.RoomId is not null).ToLookup(student => student.RoomId!.Value);
        var ineligible = new List<OverviewRoomModel>();
        var (empty, eligible) = (0, 0);
        foreach (var row in rows)
        {
            List<Guid> majors = [.. members[row.Room.RoomId].Select(member => member.MajorId)];
            var rule = rules[row.Room.GroupTypeId];
            if (majors.Count == 0)
            {
                empty++;
            }
            else if (RoomComposition.IsEligible(course.MinGroupSize, majors, rule))
            {
                eligible++;
            }
            else
            {
                ineligible.Add(new OverviewRoomModel(
                    RoomService.ToSummary(row),
                    Math.Max(0, course.MinGroupSize - majors.Count),
                    RoomComposition.SeatsStillNeeded(majors, rule),
                    rule.MinPerMajor
                        .Select(pair => new MajorCountModel(pair.Key, rule.MajorCodes.GetValueOrDefault(pair.Key, string.Empty), majors.Count(major => major == pair.Key), pair.Value))
                        .OrderBy(major => major.MajorCode, StringComparer.Ordinal)
                        .ToList()));
            }
        }

        return new CourseOverviewModel(
            course.CourseId,
            course.Phase,
            course.ExpireAt,
            course.FinalizedAt,
            course.MinGroupSize,
            students.Count,
            students.Count(student => student.RoomId is not null),
            rows.Count,
            empty,
            eligible,
            [.. students.Where(student => student.RoomId is null).Select(student => new StudentRefModel(student.StudentId, student.StudentCode, student.FullName, student.MajorCode))],
            ineligible);
    }
}
