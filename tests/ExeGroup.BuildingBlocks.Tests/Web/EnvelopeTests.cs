using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace ExeGroup.BuildingBlocks.Tests.Web;

public sealed class EnvelopeTests : IAsyncLifetime
{
    private EnvelopeHost _host = null!;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private HttpClient Client => _host.Client;

    public async ValueTask InitializeAsync() => _host = await EnvelopeHost.StartAsync();

    public async ValueTask DisposeAsync() => await _host.DisposeAsync();

    [Fact]
    public async Task Success_is_wrapped_with_message_data_and_trace_id()
    {
        var (status, body) = await GetJsonAsync("/probe/ok");

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.True(body.GetProperty("success").GetBoolean());
        Assert.Equal("Probe loaded", body.GetProperty("message").GetString());
        Assert.Equal("Alpha", body.GetProperty("data").GetProperty("name").GetString());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("errors").ValueKind);
        Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("traceId").GetString()));
        Assert.False(body.TryGetProperty("pagination", out _));
    }

    [Fact]
    public async Task Lists_carry_pagination_metadata()
    {
        var (_, body) = await GetJsonAsync("/probe/page?page=1&pageSize=500");

        var pagination = body.GetProperty("pagination");
        Assert.Equal(100, pagination.GetProperty("pageSize").GetInt32());
        Assert.Equal(3, pagination.GetProperty("totalItems").GetInt32());
        Assert.Equal(1, pagination.GetProperty("totalPages").GetInt32());
        Assert.Equal(3, body.GetProperty("data").GetArrayLength());
    }

    [Fact]
    public async Task Fields_keep_only_the_requested_properties()
    {
        var (_, body) = await GetJsonAsync("/probe/page?fields=code,members");

        var first = body.GetProperty("data")[0];
        Assert.Equal("A", first.GetProperty("code").GetString());
        Assert.True(first.TryGetProperty("members", out _));
        Assert.False(first.TryGetProperty("name", out _));
    }

    [Fact]
    public async Task Fields_hidden_from_json_cannot_be_selected()
    {
        var (status, body) = await GetJsonAsync("/probe/secrets?fields=secret");

        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.DoesNotContain("hash-123", body.GetRawText());
    }

    [Fact]
    public async Task Unknown_fields_are_rejected_as_validation_errors()
    {
        var (status, body) = await GetJsonAsync("/probe/page?fields=password");

        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Equal("fields", body.GetProperty("errors")[0].GetProperty("field").GetString());
    }

    [Fact]
    public async Task Business_rule_conflict_returns_409_with_its_code()
    {
        var (status, body) = await GetJsonAsync("/probe/conflict");

        Assert.Equal(HttpStatusCode.Conflict, status);
        Assert.False(body.GetProperty("success").GetBoolean());
        Assert.Equal("GROUP_FULL", body.GetProperty("errors")[0].GetProperty("code").GetString());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("data").ValueKind);
        Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("traceId").GetString()));
    }

    [Theory]
    [InlineData("/probe/missing", HttpStatusCode.NotFound, "NOT_FOUND")]
    [InlineData("/probe/forbidden", HttpStatusCode.Forbidden, "FORBIDDEN")]
    [InlineData("/no-such-route", HttpStatusCode.NotFound, "NOT_FOUND")]
    public async Task Errors_map_to_status_and_code(string path, HttpStatusCode expectedStatus, string expectedCode)
    {
        var (status, body) = await GetJsonAsync(path);

        Assert.Equal(expectedStatus, status);
        Assert.Equal(expectedCode, body.GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Fact]
    public async Task Unhandled_exception_hides_internal_details()
    {
        var response = await Client.GetAsync("/probe/crash", Ct);
        var text = await response.Content.ReadAsStringAsync(Ct);

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.DoesNotContain("secret", text);
        Assert.DoesNotContain("InvalidOperationException", text);
        Assert.Contains("INTERNAL_ERROR", text);
    }

    [Fact]
    public async Task Data_annotation_failure_names_the_camel_case_field()
    {
        var response = await Client.PostAsJsonAsync("/probe", new { members = 3 }, Ct);
        var body = await ReadAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var error = body.GetProperty("errors")[0];
        Assert.Equal("name", error.GetProperty("field").GetString());
        Assert.Equal("VALIDATION_FAILED", error.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Fluent_validation_failure_names_the_camel_case_field()
    {
        var response = await Client.PostAsJsonAsync("/probe", new { name = "Delta", members = 99 }, Ct);
        var body = await ReadAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("members", body.GetProperty("errors")[0].GetProperty("field").GetString());
    }

    [Fact]
    public async Task Unknown_json_properties_are_rejected()
    {
        var response = await Client.PostAsJsonAsync("/probe", new { name = "Delta", members = 2, isAdmin = true }, Ct);
        var body = await ReadAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("VALIDATION_FAILED", body.GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Fact]
    public async Task Created_returns_201_with_location()
    {
        var response = await Client.PostAsJsonAsync("/probe", new { name = "Delta", members = 2 }, Ct);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(response.Headers.Location);
    }

    [Fact]
    public async Task Xml_is_returned_when_the_client_asks_for_it()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/probe/ok");
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/xml"));

        var response = await Client.SendAsync(request, Ct);
        var text = await response.Content.ReadAsStringAsync(Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/xml", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains("<success>true</success>", text);
        Assert.Contains("<name>Alpha</name>", text);
    }

    [Fact]
    public async Task Errors_are_returned_as_xml_when_the_client_asks_for_it()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/probe/conflict");
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/xml"));

        var response = await Client.SendAsync(request, Ct);
        var text = await response.Content.ReadAsStringAsync(Ct);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("<code>GROUP_FULL</code>", text);
    }

    [Fact]
    public async Task Unsupported_media_type_in_accept_returns_406()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/probe/ok");
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/csv"));

        var response = await Client.SendAsync(request, Ct);
        var body = await ReadAsync(response);

        Assert.Equal(HttpStatusCode.NotAcceptable, response.StatusCode);
        Assert.Equal("NOT_ACCEPTABLE", body.GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Fact]
    public async Task Unauthorized_exception_returns_401()
    {
        var (status, body) = await GetJsonAsync("/probe/anonymous-only");

        Assert.Equal(HttpStatusCode.Unauthorized, status);
        Assert.Equal("UNAUTHORIZED", body.GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Fact]
    public async Task Wrong_method_returns_405_envelope()
    {
        var response = await Client.DeleteAsync("/probe/ok", Ct);
        var body = await ReadAsync(response);

        Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
        Assert.Equal("METHOD_NOT_ALLOWED", body.GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Fact]
    public async Task Non_json_body_returns_415_envelope()
    {
        using var content = new StringContent("name=x", System.Text.Encoding.UTF8, "text/plain");
        var response = await Client.PostAsync("/probe", content, Ct);
        var body = await ReadAsync(response);

        Assert.Equal(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
        Assert.Equal("UNSUPPORTED_MEDIA_TYPE", body.GetProperty("errors")[0].GetProperty("code").GetString());
    }

    [Fact]
    public async Task Malformed_json_returns_400_envelope()
    {
        using var content = new StringContent("{ \"name\": ", System.Text.Encoding.UTF8, "application/json");
        var response = await Client.PostAsync("/probe", content, Ct);
        var body = await ReadAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.False(body.GetProperty("success").GetBoolean());
    }

    [Theory]
    [InlineData("/probe/ok")]
    [InlineData("/probe/conflict")]
    public async Task Browser_style_accept_gets_the_same_format_for_success_and_errors(string path)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.TryAddWithoutValidation("Accept", "text/html,application/xml;q=0.9,*/*;q=0.8");

        var response = await Client.SendAsync(request, Ct);

        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
    }

    private async Task<(HttpStatusCode Status, JsonElement Body)> GetJsonAsync(string path)
    {
        var response = await Client.GetAsync(path, Ct);
        return (response.StatusCode, await ReadAsync(response));
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement;
}
