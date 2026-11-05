using ExeGroup.Group.Repositories.Entities;

namespace ExeGroup.Group.Repositories.Interfaces;

public interface IOutboxRepository
{
    void Add(OutboxEvent outboxEvent);

    Task<List<OutboxEvent>> ListUnpublishedAsync(int take, CancellationToken cancellationToken);

    Task<int> DeletePublishedBeforeAsync(DateTime publishedBeforeUtc, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
