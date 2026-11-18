using ExeGroup.Group.Repositories.Data;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Group.Repositories.Repositories;

public sealed class ProjectRepository(GroupDbContext context) : IProjectRepository
{
    public Task<List<ProjectMilestone>> ListMilestonesAsync(Guid courseId, CancellationToken cancellationToken) =>
        context.ProjectMilestones
            .Where(milestone => milestone.CourseId == courseId)
            .OrderBy(milestone => milestone.Sequence)
            .ToListAsync(cancellationToken);

    public Task<ProjectMilestone?> FindMilestoneAsync(Guid milestoneId, CancellationToken cancellationToken) =>
        context.ProjectMilestones.SingleOrDefaultAsync(milestone => milestone.MilestoneId == milestoneId, cancellationToken);

    public Task<ProjectMilestone?> FindMilestoneByNameAsync(Guid courseId, string name, CancellationToken cancellationToken) =>
        context.ProjectMilestones.SingleOrDefaultAsync(milestone => milestone.CourseId == courseId && milestone.Name == name, cancellationToken);

    public async Task<int> NextSequenceAsync(Guid courseId, CancellationToken cancellationToken)
    {
        var highest = await context.ProjectMilestones
            .Where(milestone => milestone.CourseId == courseId)
            .Select(milestone => (int?)milestone.Sequence)
            .MaxAsync(cancellationToken);
        return (highest ?? 0) + 1;
    }

    public Task<List<ProjectDeliverable>> ListDeliverablesAsync(Guid courseId, CancellationToken cancellationToken) =>
        context.ProjectDeliverables
            .Where(deliverable => deliverable.CourseId == courseId)
            .ToListAsync(cancellationToken);

    public Task<List<ProjectDeliverable>> ListDeliverablesForMilestoneAsync(Guid milestoneId, CancellationToken cancellationToken) =>
        context.ProjectDeliverables
            .Where(deliverable => deliverable.MilestoneId == milestoneId)
            .ToListAsync(cancellationToken);

    public Task<ProjectDeliverable?> FindDeliverableAsync(Guid deliverableId, CancellationToken cancellationToken) =>
        context.ProjectDeliverables.SingleOrDefaultAsync(deliverable => deliverable.DeliverableId == deliverableId, cancellationToken);

    public Task<ProjectDeliverable?> FindDeliverableAsync(Guid milestoneId, Guid roomId, CancellationToken cancellationToken) =>
        context.ProjectDeliverables
            .SingleOrDefaultAsync(deliverable => deliverable.MilestoneId == milestoneId && deliverable.RoomId == roomId, cancellationToken);

    public async Task<List<DeliverableRow>> ListDeliverableRowsAsync(Guid courseId, CancellationToken cancellationToken)
    {
        var rows = await (
            from deliverable in context.ProjectDeliverables.AsNoTracking()
            where deliverable.CourseId == courseId
            join room in context.Rooms.AsNoTracking() on deliverable.RoomId equals room.RoomId
            orderby deliverable.MilestoneId, room.GroupNo, room.Name
            select new { deliverable, room.Name, room.GroupNo })
            .ToListAsync(cancellationToken);
        return rows
            .Select(row => new DeliverableRow(row.deliverable, row.Name, row.GroupNo))
            .ToList();
    }

    public void AddMilestone(ProjectMilestone milestone) => context.ProjectMilestones.Add(milestone);

    public void AddDeliverable(ProjectDeliverable deliverable) => context.ProjectDeliverables.Add(deliverable);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);
}
