using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.Repositories.Interfaces;

public sealed record DeliverableRow(ProjectDeliverable Deliverable, string RoomName, int? GroupNo);

public interface IProjectRepository
{
    Task<List<ProjectMilestone>> ListMilestonesAsync(Guid courseId, CancellationToken cancellationToken);

    Task<ProjectMilestone?> FindMilestoneAsync(Guid milestoneId, CancellationToken cancellationToken);

    Task<ProjectMilestone?> FindMilestoneByNameAsync(Guid courseId, string name, CancellationToken cancellationToken);

    Task<int> NextSequenceAsync(Guid courseId, CancellationToken cancellationToken);

    Task<List<ProjectDeliverable>> ListDeliverablesAsync(Guid courseId, CancellationToken cancellationToken);

    Task<List<ProjectDeliverable>> ListDeliverablesForMilestoneAsync(Guid milestoneId, CancellationToken cancellationToken);

    Task<ProjectDeliverable?> FindDeliverableAsync(Guid deliverableId, CancellationToken cancellationToken);

    Task<ProjectDeliverable?> FindDeliverableAsync(Guid milestoneId, Guid roomId, CancellationToken cancellationToken);

    Task<List<DeliverableRow>> ListDeliverableRowsAsync(Guid courseId, CancellationToken cancellationToken);

    void AddMilestone(ProjectMilestone milestone);

    void AddDeliverable(ProjectDeliverable deliverable);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
