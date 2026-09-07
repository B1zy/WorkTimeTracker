namespace WorkTimeTracker.Tests.TestHelpers;

// WeatherService resolves its OpenWeather client via IHttpClientFactory
// (see Program.cs's named "OpenWeather" registration) rather than a second
// typed client -- this just hands back whatever HttpClient the test built,
// regardless of the name asked for.
public class FakeHttpClientFactory(HttpClient client) : IHttpClientFactory
{
    public HttpClient CreateClient(string name) => client;
}
