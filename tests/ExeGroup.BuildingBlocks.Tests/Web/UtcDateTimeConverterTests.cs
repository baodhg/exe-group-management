using System.Text.Json;
using ExeGroup.BuildingBlocks.Web.Formatters;

namespace ExeGroup.BuildingBlocks.Tests.Web;

public sealed class UtcDateTimeConverterTests
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web) { Converters = { new UtcDateTimeConverter() } };

    [Fact]
    public void A_time_read_from_the_database_goes_out_as_utc()
    {
        var fromDatabase = new DateTime(2026, 11, 5, 17, 24, 0, DateTimeKind.Unspecified);

        Assert.Equal("\"2026-11-05T17:24:00Z\"", JsonSerializer.Serialize(fromDatabase, Options));
        Assert.Equal("\"2026-11-05T17:24:00.5Z\"", JsonSerializer.Serialize(fromDatabase.AddMilliseconds(500), Options));
        Assert.Equal("{\"at\":null}", JsonSerializer.Serialize(new { At = (DateTime?)null }, Options));
    }

    [Fact]
    public void A_local_time_is_converted_before_it_goes_out()
    {
        var utc = new DateTime(2026, 11, 5, 17, 24, 0, DateTimeKind.Utc);

        Assert.Equal(JsonSerializer.Serialize(utc, Options), JsonSerializer.Serialize(utc.ToLocalTime(), Options));
    }

    [Theory]
    [InlineData("\"2026-11-06T00:24:00+07:00\"")]
    [InlineData("\"2026-11-05T17:24:00Z\"")]
    [InlineData("\"2026-11-05T17:24:00\"")]
    public void Times_coming_in_are_read_as_utc(string json)
    {
        var value = JsonSerializer.Deserialize<DateTime>(json, Options);

        Assert.Equal(DateTimeKind.Utc, value.Kind);
        Assert.Equal(new DateTime(2026, 11, 5, 17, 24, 0, DateTimeKind.Utc), value);
    }

    [Fact]
    public void Text_that_is_not_a_time_is_rejected()
    {
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<DateTime>("\"next week\"", Options));
    }
}
