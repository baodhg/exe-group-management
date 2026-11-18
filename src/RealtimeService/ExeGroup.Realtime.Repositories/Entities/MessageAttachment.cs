namespace ExeGroup.Realtime.Repositories.Entities;

public sealed class MessageAttachment
{
    public Guid AttachmentId { get; set; }

    public Guid MessageId { get; set; }

    public string FileName { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    public int SizeBytes { get; set; }

    public byte[] Data { get; set; } = [];
}
