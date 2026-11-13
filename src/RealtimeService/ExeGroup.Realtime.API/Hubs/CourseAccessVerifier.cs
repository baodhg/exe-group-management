using System.Net;
using System.Net.Http.Headers;

namespace ExeGroup.Realtime.API.Hubs;

public interface ICourseAccessVerifier
{
    Task<bool> CanReadAsync(Guid courseId, string accessToken, CancellationToken cancellationToken);
}

public sealed class CourseAccessVerifier(HttpClient client) : ICourseAccessVerifier
{
    public async Task<bool> CanReadAsync(Guid courseId, string accessToken, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"api/v1/courses/{courseId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        using var response = await client.SendAsync(request, cancellationToken);
        return response.StatusCode == HttpStatusCode.OK;
    }
}
