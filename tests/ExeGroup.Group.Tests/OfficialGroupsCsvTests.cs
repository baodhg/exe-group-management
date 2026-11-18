using ExeGroup.Group.Services.Courses;

namespace ExeGroup.Group.Tests;

public sealed class OfficialGroupsCsvTests
{
    [Fact]
    public void A_plain_value_stays_untouched()
    {
        Assert.Equal("Nhóm 1", OfficialGroupsCsv.Escape("Nhóm 1"));
        Assert.Equal(string.Empty, OfficialGroupsCsv.Escape(string.Empty));
    }

    [Fact]
    public void A_value_with_the_separator_is_quoted()
    {
        Assert.Equal("\"Nhóm 1; Phòng 2\"", OfficialGroupsCsv.Escape("Nhóm 1; Phòng 2"));
    }

    [Fact]
    public void A_quote_inside_a_value_is_doubled()
    {
        Assert.Equal("\"Nhóm \"\"1\"\"\"", OfficialGroupsCsv.Escape("Nhóm \"1\""));
    }

    [Fact]
    public void A_value_with_a_line_break_is_quoted()
    {
        Assert.Equal("\"Nhóm 1\nPhòng 2\"", OfficialGroupsCsv.Escape("Nhóm 1\nPhòng 2"));
    }

    [Fact]
    public void The_header_names_every_column_of_the_export()
    {
        var csv = OfficialGroupsCsv.Build(EmptyGroups());

        Assert.StartsWith("Nhóm;Phòng;Đề tài;Trạng thái đề tài;Loại nhóm;Trưởng nhóm;Mã SV;Họ tên;Ngành;Vị trí", csv, StringComparison.Ordinal);
    }

    [Fact]
    public void The_bytes_start_with_a_byte_order_mark()
    {
        var bytes = OfficialGroupsCsv.BuildBytes(EmptyGroups());

        Assert.Equal([0xEF, 0xBB, 0xBF], bytes.Take(3));
    }

    private static OfficialGroupsModel EmptyGroups() =>
        new(Guid.Parse("55555555-5555-5555-5555-555555555555"), "EXE101", "Finalized", []);
}
