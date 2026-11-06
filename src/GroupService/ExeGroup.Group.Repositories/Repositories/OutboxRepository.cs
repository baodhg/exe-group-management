using ExeGroup.Group.Repositories.Data;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Group.Repositories.Repositories;

public sealed class OutboxRepository(GroupDbContext context) : IOutboxRepository
{
    public void Add(OutboxEvent outboxEvent) => context.OutboxEvents.Add(outboxEvent);

    public Task<List<OutboxEvent>> ListUnpublishedAsync(int take, CancellationToken cancellationToken) =>
        context.OutboxEvents
            .Where(outboxEvent => outboxEvent.PublishedAtUtc == null)
            .OrderBy(outboxEvent => outboxEvent.OccurredAtUtc)
            .ThenBy(outboxEvent => outboxEvent.EventId)
            .Take(take)
            .ToListAsync(cancellationToken);

    public Task<int> DeletePublishedBeforeAsync(DateTime publishedBeforeUtc, CancellationToken cancellationToken) =>
        context.OutboxEvents
            .Where(outboxEvent => outboxEvent.PublishedAtUtc != null && outboxEvent.PublishedAtUtc < publishedBeforeUtc)
            .ExecuteDeleteAsync(cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);
}
