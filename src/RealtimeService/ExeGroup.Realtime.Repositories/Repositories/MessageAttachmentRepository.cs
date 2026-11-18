using ExeGroup.Realtime.Repositories.Data;
using ExeGroup.Realtime.Repositories.Entities;
using ExeGroup.Realtime.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ExeGroup.Realtime.Repositories.Repositories;

public sealed class MessageAttachmentRepository(ChatDbContext context) : IMessageAttachmentRepository
{
    public Task<MessageAttachment?> FindAsync(Guid attachmentId, CancellationToken cancellationToken) =>
        context.MessageAttachments.AsNoTracking()
            .SingleOrDefaultAsync(attachment => attachment.AttachmentId == attachmentId, cancellationToken);
}
