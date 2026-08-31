using System.Net;

namespace WorkTimeTracker.Tests.TestHelpers;

// Intercepts outgoing HttpClient requests so WeatherService can be tested
// without ever hitting the real weatherapi.com over the network.
public class FakeHttpMessageHandler : HttpMessageHandler
{
    private readonly Func<HttpRequestMessage, HttpResponseMessage> _responder;
    public List<Uri> RequestedUris { get; } = [];

    public FakeHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> responder)
    {
        _responder = responder;
    }

    // Convenience constructor for tests that always return the same body/status.
    public FakeHttpMessageHandler(HttpStatusCode statusCode, string jsonBody)
        : this(_ => new HttpResponseMessage(statusCode) { Content = new StringContent(jsonBody) })
    {
    }

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        RequestedUris.Add(request.RequestUri!);
        return Task.FromResult(_responder(request));
    }
}
