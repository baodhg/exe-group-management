using ExeGroup.Group.Repositories.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Conventions;

namespace ExeGroup.Group.Repositories.Data;

public sealed class GroupDbContext(DbContextOptions<GroupDbContext> options) : DbContext(options)
{
    public DbSet<Semester> Semesters => Set<Semester>();

    public DbSet<Subject> Subjects => Set<Subject>();

    public DbSet<Major> Majors => Set<Major>();

    public DbSet<Skill> Skills => Set<Skill>();

    public DbSet<SemesterStudent> SemesterStudents => Set<SemesterStudent>();

    public DbSet<StudentSkill> StudentSkills => Set<StudentSkill>();

    public DbSet<Course> Courses => Set<Course>();

    public DbSet<CourseEnrollment> CourseEnrollments => Set<CourseEnrollment>();

    public DbSet<GroupType> GroupTypes => Set<GroupType>();

    public DbSet<GroupTypeMajor> GroupTypeMajors => Set<GroupTypeMajor>();

    public DbSet<SemesterGroupType> SemesterGroupTypes => Set<SemesterGroupType>();

    public DbSet<Room> Rooms => Set<Room>();

    public DbSet<RoomMember> RoomMembers => Set<RoomMember>();

    public DbSet<JoinRequest> JoinRequests => Set<JoinRequest>();

    public DbSet<OutboxEvent> OutboxEvents => Set<OutboxEvent>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Conventions.Remove(typeof(ForeignKeyIndexConvention));
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(GroupDbContext).Assembly);
    }
}
