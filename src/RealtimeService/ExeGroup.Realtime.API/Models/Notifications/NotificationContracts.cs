using ExeGroup.Realtime.Services.Notifications;

namespace ExeGroup.Realtime.API.Models.Notifications;

public sealed record NotificationResponse(Guid Id, string Type, string Title, string Body, DateTime CreatedAt, DateTime? ReadAt);

public sealed record ReadAllResponse(int Updated);

public static class NotificationMappings
{
    public static NotificationResponse ToResponse(this NotificationModel model) =>
        new(model.Id, model.Type, model.Title, model.Body, model.CreatedAt, model.ReadAt);
}
