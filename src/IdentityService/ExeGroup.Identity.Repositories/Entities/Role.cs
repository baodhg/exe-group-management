namespace ExeGroup.Identity.Repositories.Entities;

public sealed class Role
{
    public static readonly Guid StudentId = Guid.Parse("6B1F2A40-0001-4C1A-9F00-000000000001");
    public static readonly Guid LecturerId = Guid.Parse("6B1F2A40-0002-4C1A-9F00-000000000002");
    public static readonly Guid AdministratorId = Guid.Parse("6B1F2A40-0003-4C1A-9F00-000000000003");

    public Guid RoleId { get; set; }

    public string Name { get; set; } = string.Empty;

    public ICollection<UserRole> UserRoles { get; } = [];
}
