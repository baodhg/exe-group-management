using ExeGroup.BuildingBlocks.Context;
using ExeGroup.Group.Repositories.Entities;
using ExeGroup.Group.Repositories.Interfaces;
using ExeGroup.Group.Services.Events;

namespace ExeGroup.Group.Services.Rooms;

public sealed class RequestCloser(IRoomRepository rooms, IOutbox outbox, IClock clock)
{
    public static string StatusFor(string reasonCode) => reasonCode switch
    {
        JoinRequestReasons.Withdrawn or JoinRequestReasons.JoinedAnotherRoom or JoinRequestReasons.RoomReopened => JoinRequestStatuses.Cancelled,
        _ => JoinRequestStatuses.Rejected,
    };

    public async Task CloseAsync(IReadOnlyCollection<JoinRequest> requests, string reasonCode, Guid? decidedBy, CancellationToken cancellationToken, string? reasonText = null)
    {
        var pending = requests.Where(request => request.Status == JoinRequestStatuses.Pending).ToList();
        if (pending.Count == 0)
        {
            return;
        }

        var names = await rooms.FindRoomNamesAsync(pending.Select(request => request.RoomId).Distinct().ToList(), cancellationToken);
        var status = StatusFor(reasonCode);
        foreach (var request in pending)
        {
            request.Status = status;
            request.ReasonCode = reasonCode;
            request.ReasonText = reasonText;
            request.DecidedBy = decidedBy;
            request.DecidedAt = clock.UtcNow;
            outbox.Enqueue(
                GroupEventTypes.JoinRequestDecided,
                request.RequestId,
                new JoinRequestDecidedEvent(request.RequestId, request.CourseId, request.RoomId, names.GetValueOrDefault(request.RoomId, string.Empty), request.StudentId, status, reasonCode));
        }
    }
}
