using ExeGroup.BuildingBlocks.Data;
using ExeGroup.BuildingBlocks.Paging;
using ExeGroup.Group.Repositories.Data;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Group.Repositories.Repositories;

public sealed class RoomRepository(GroupDbContext context) : IRoomRepository
{
    private static readonly SortMap<RoomRow> Sorting = new SortMap<RoomRow>()
        .Add("name", row => row.Room.Name)
        .Add("memberCount", row => row.Room.MemberCount)
        .Add("status", row => row.Room.Status)
        .Add("groupNo", row => row.Room.GroupNo)
        .ByDefault("name")
        .TieBreaker(row => row.Room.RoomId);

    public Task<PagedResult<RoomRow>> GetPageAsync(Guid courseId, RoomFilter filter, ListQuery query, CancellationToken cancellationToken)
    {
        var rooms = context.Rooms.AsNoTracking().Where(room => room.CourseId == courseId);
        if (filter.Status is { } status)
        {
            rooms = rooms.Where(room => room.Status == status);
        }

        if (filter.HasSeat is { } hasSeat)
        {
            rooms = hasSeat ? rooms.Where(room => room.MemberCount < room.Capacity) : rooms.Where(room => room.MemberCount >= room.Capacity);
        }

        if (filter.GroupTypeId is { } groupTypeId)
        {
            rooms = rooms.Where(room => room.GroupTypeId == groupTypeId);
        }

        if (query.Search is { } search)
        {
            rooms = rooms.Where(room => room.Name.Contains(search) || (room.Topic != null && room.Topic.Contains(search)));
        }

        return Rows(rooms).ToPagedResultAsync(query, Sorting, cancellationToken);
    }

    public Task<RoomRow?> FindRowAsync(Guid roomId, CancellationToken cancellationToken) =>
        Rows(context.Rooms.AsNoTracking().Where(room => room.RoomId == roomId)).SingleOrDefaultAsync(cancellationToken);

    public Task<List<RoomRow>> ListRowsWithSeatAsync(Guid courseId, CancellationToken cancellationToken) =>
        Rows(context.Rooms.AsNoTracking().Where(room => room.CourseId == courseId && room.MemberCount < room.Capacity))
            .OrderBy(row => row.Room.Name)
            .ToListAsync(cancellationToken);

    public async Task<List<CourseStudentProfile>> ListCourseStudentsAsync(Course course, CancellationToken cancellationToken)
    {
        var students = await (
            from enrollment in context.CourseEnrollments.AsNoTracking()
            where enrollment.CourseId == course.CourseId
            join student in context.SemesterStudents on new { enrollment.SemesterId, enrollment.StudentId } equals new { student.SemesterId, student.StudentId }
            join major in context.Majors on student.MajorId equals major.MajorId
            orderby student.StudentCode
            select new { student.StudentId, student.StudentCode, student.FullName, student.MajorId, MajorCode = major.Code })
            .ToListAsync(cancellationToken);
        var rooms = await context.RoomMembers.AsNoTracking()
            .Where(member => member.CourseId == course.CourseId && member.EndedAt == null)
            .ToDictionaryAsync(member => member.StudentId, member => member.RoomId, cancellationToken);
        var skills = await (
            from rating in context.StudentSkills.AsNoTracking()
            where rating.SemesterId == course.SemesterId
                && context.CourseEnrollments.Any(enrollment => enrollment.CourseId == course.CourseId && enrollment.StudentId == rating.StudentId)
            join skill in context.Skills on rating.SkillId equals skill.SkillId
            select new { rating.StudentId, skill.Code, rating.Level })
            .ToListAsync(cancellationToken);
        var skillsByStudent = skills.ToLookup(skill => skill.StudentId);
        return students
            .Select(student => new CourseStudentProfile(
                student.StudentId,
                student.StudentCode,
                student.FullName,
                student.MajorId,
                student.MajorCode,
                rooms.TryGetValue(student.StudentId, out var roomId) ? roomId : null,
                skillsByStudent[student.StudentId].ToDictionary(skill => skill.Code, skill => (int)skill.Level)))
            .ToList();
    }

    public Task<List<Guid>> ListRoomsRemovedFromAsync(Guid courseId, Guid studentId, CancellationToken cancellationToken) =>
        context.RoomMembers
            .Where(member => member.CourseId == courseId && member.StudentId == studentId && member.EndReason == MembershipEndReasons.Removed)
            .Select(member => member.RoomId)
            .Distinct()
            .ToListAsync(cancellationToken);

    public Task<Room?> FindAsync(Guid roomId, CancellationToken cancellationToken) =>
        context.Rooms.SingleOrDefaultAsync(room => room.RoomId == roomId, cancellationToken);

    public Task<Course?> FindCourseAsync(Guid courseId, CancellationToken cancellationToken) =>
        context.Courses.AsNoTracking().SingleOrDefaultAsync(course => course.CourseId == courseId, cancellationToken);

    public async Task<List<MemberProfile>> ListMemberProfilesAsync(Room room, CancellationToken cancellationToken)
    {
        var members = await (
            from member in context.RoomMembers.AsNoTracking()
            where member.RoomId == room.RoomId && member.EndedAt == null
            join student in context.SemesterStudents on new { room.SemesterId, member.StudentId } equals new { student.SemesterId, student.StudentId }
            join major in context.Majors on student.MajorId equals major.MajorId
            orderby member.JoinedAt
            select new { member.StudentId, student.StudentCode, student.FullName, student.MajorId, MajorCode = major.Code, member.JoinedAt, member.JoinedVia })
            .ToListAsync(cancellationToken);
        var studentIds = members.Select(member => member.StudentId).ToList();
        var skills = await (
            from rating in context.StudentSkills.AsNoTracking()
            where rating.SemesterId == room.SemesterId && studentIds.Contains(rating.StudentId)
            join skill in context.Skills on rating.SkillId equals skill.SkillId
            select new { rating.StudentId, skill.Code, rating.Level })
            .ToListAsync(cancellationToken);
        return members
            .Select(member => new MemberProfile(
                member.StudentId,
                member.StudentCode,
                member.FullName,
                member.MajorId,
                member.MajorCode,
                member.JoinedAt,
                member.JoinedVia,
                skills.Where(skill => skill.StudentId == member.StudentId).OrderBy(skill => skill.Code).Select(skill => (skill.Code, skill.Level)).ToList()))
            .ToList();
    }

    public Task<List<RoomMember>> ListActiveMembersAsync(Guid roomId, CancellationToken cancellationToken) =>
        context.RoomMembers.Where(member => member.RoomId == roomId && member.EndedAt == null).OrderBy(member => member.JoinedAt).ToListAsync(cancellationToken);

    public Task<RoomMember?> FindActiveMembershipAsync(Guid courseId, Guid studentId, CancellationToken cancellationToken) =>
        context.RoomMembers.SingleOrDefaultAsync(member => member.CourseId == courseId && member.StudentId == studentId && member.EndedAt == null, cancellationToken);

    public Task<bool> WasRemovedFromRoomAsync(Guid roomId, Guid studentId, CancellationToken cancellationToken) =>
        context.RoomMembers.AnyAsync(member => member.RoomId == roomId && member.StudentId == studentId && member.EndReason == MembershipEndReasons.Removed, cancellationToken);

    public Task<bool> IsEnrolledAsync(Guid courseId, Guid studentId, CancellationToken cancellationToken) =>
        context.CourseEnrollments.AnyAsync(enrollment => enrollment.CourseId == courseId && enrollment.StudentId == studentId, cancellationToken);

    public Task<Guid?> FindMajorAsync(Guid semesterId, Guid studentId, CancellationToken cancellationToken) =>
        context.SemesterStudents
            .Where(student => student.SemesterId == semesterId && student.StudentId == studentId)
            .Select(student => (Guid?)student.MajorId)
            .SingleOrDefaultAsync(cancellationToken);

    public Task<List<Guid>> ListMemberMajorsAsync(Room room, CancellationToken cancellationToken) =>
        (from member in context.RoomMembers
         where member.RoomId == room.RoomId && member.EndedAt == null
         join student in context.SemesterStudents on new { room.SemesterId, member.StudentId } equals new { student.SemesterId, student.StudentId }
         select student.MajorId).ToListAsync(cancellationToken);

    public async Task<GroupTypeRules> GetRulesAsync(Guid groupTypeId, CancellationToken cancellationToken)
    {
        var groupType = await context.GroupTypes.AsNoTracking().Include(type => type.Majors).SingleAsync(type => type.GroupTypeId == groupTypeId, cancellationToken);
        var majorIds = groupType.Majors.Select(rule => rule.MajorId).ToList();
        var codes = await context.Majors.AsNoTracking().Where(major => majorIds.Contains(major.MajorId)).ToDictionaryAsync(major => major.MajorId, major => major.Code, cancellationToken);
        return new GroupTypeRules(
            groupType.GroupTypeId,
            groupType.Code,
            groupType.Name,
            groupType.MinDistinctMajors,
            groupType.Majors.ToDictionary(rule => rule.MajorId, rule => rule.MinMembers),
            codes);
    }

    public Task<bool> IsGroupTypeAllowedAsync(Guid semesterId, Guid groupTypeId, CancellationToken cancellationToken) =>
        context.SemesterGroupTypes.AnyAsync(link => link.SemesterId == semesterId && link.GroupTypeId == groupTypeId, cancellationToken);

    public Task<bool> NameExistsAsync(Guid courseId, string name, Guid exceptRoomId, CancellationToken cancellationToken) =>
        context.Rooms.AnyAsync(room => room.CourseId == courseId && room.Name == name && room.RoomId != exceptRoomId, cancellationToken);

    public Task<List<JoinRequest>> ListPendingForRoomAsync(Guid roomId, CancellationToken cancellationToken) =>
        context.JoinRequests.Where(request => request.RoomId == roomId && request.Status == JoinRequestStatuses.Pending).ToListAsync(cancellationToken);

    public Task<List<JoinRequest>> ListPendingForStudentAsync(Guid courseId, Guid studentId, CancellationToken cancellationToken) =>
        context.JoinRequests.Where(request => request.CourseId == courseId && request.StudentId == studentId && request.Status == JoinRequestStatuses.Pending)
            .ToListAsync(cancellationToken);

    public Task<Dictionary<Guid, string>> FindRoomNamesAsync(IReadOnlyCollection<Guid> roomIds, CancellationToken cancellationToken) =>
        context.Rooms.AsNoTracking().Where(room => roomIds.Contains(room.RoomId)).ToDictionaryAsync(room => room.RoomId, room => room.Name, cancellationToken);

    public void Add(RoomMember member) => context.RoomMembers.Add(member);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);

    public Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken) => context.TrySaveChangesAsync(cancellationToken);

    private IQueryable<RoomRow> Rows(IQueryable<Room> rooms) =>
        from room in rooms
        join groupType in context.GroupTypes on room.GroupTypeId equals groupType.GroupTypeId
        select new RoomRow
        {
            Room = room,
            GroupTypeCode = groupType.Code,
            LeaderName = context.SemesterStudents
                .Where(student => student.SemesterId == room.SemesterId && student.StudentId == room.LeaderId)
                .Select(student => student.FullName)
                .FirstOrDefault(),
        };
}
