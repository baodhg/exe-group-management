using System.Globalization;
using System.Text;

namespace ExeGroup.Group.Services.Courses;

public static class OfficialGroupsCsv
{
    public const string Separator = ";";

    public static string Build(OfficialGroupsModel model)
    {
        var builder = new StringBuilder();
        builder.AppendLine(string.Join(Separator, ["Nhóm", "Phòng", "Đề tài", "Trạng thái đề tài", "Loại nhóm", "Trưởng nhóm", "Mã SV", "Họ tên", "Ngành", "Vị trí"]));
        foreach (var group in model.Groups)
        {
            var state = group.TopicMissing ? "Chưa có" : "Đã có";
            if (group.Members.Count == 0)
            {
                builder.AppendLine(string.Join(Separator, [group.GroupNo.ToString(CultureInfo.InvariantCulture), Escape(group.RoomName), Escape(group.Topic ?? string.Empty), state, Escape(group.GroupTypeName), Escape(group.LeaderName ?? string.Empty)]));
                continue;
            }

            foreach (var member in group.Members)
            {
                builder.AppendLine(string.Join(Separator,
                [
                    group.GroupNo.ToString(CultureInfo.InvariantCulture),
                    Escape(group.RoomName),
                    Escape(group.Topic ?? string.Empty),
                    state,
                    Escape(group.GroupTypeName),
                    Escape(group.LeaderName ?? string.Empty),
                    Escape(member.StudentCode),
                    Escape(member.FullName),
                    Escape(member.MajorCode),
                    member.IsLeader ? "Trưởng nhóm" : "Thành viên"
                ]));
            }
        }

        return builder.ToString();
    }

    public static string Escape(string value)
    {
        if (!value.Contains(Separator, StringComparison.Ordinal) && !value.Contains('"') && !value.Contains('\n') && !value.Contains('\r'))
        {
            return value;
        }

        return $"\"{value.Replace("\"", "\"\"", StringComparison.Ordinal)}\"";
    }

    public static byte[] BuildBytes(OfficialGroupsModel model) =>
        Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(Build(model))).ToArray();
}
