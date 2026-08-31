using System.Net;
using Microsoft.Extensions.Options;
using WorkTimeTracker.Models;
using WorkTimeTracker.Services;
using WorkTimeTracker.Tests.TestHelpers;

namespace WorkTimeTracker.Tests.Services;

public class WeatherServiceTests
{
    private const string ForecastDayJson = """
        {
          "date": "2026-08-31",
          "day": {
            "maxtemp_c": 22.5,
            "mintemp_c": 16.3,
            "totalprecip_mm": 4.98,
            "maxwind_kph": 27,
            "condition": { "text": "Overcast", "code": 1009 }
          },
          "hour": [
            {
              "time": "2026-08-31 00:00",
              "temp_c": 19.4,
              "condition": { "text": "Overcast", "code": 1009 },
              "chance_of_rain": 16,
              "chance_of_snow": 0
            },
            {
              "time": "2026-08-31 01:00",
              "temp_c": 19.1,
              "condition": { "text": "Light rain shower", "code": 1240 },
              "chance_of_rain": 30,
              "chance_of_snow": 45
            }
          ]
        }
        """;

    private static string ForecastResponse(string dayJson) => $$"""{ "forecast": { "forecastday": [{{dayJson}}] } }""";

    private static string HistoryDayJson(string date) => $$"""
        {
          "date": "{{date}}",
          "day": {
            "maxtemp_c": 10,
            "mintemp_c": 5,
            "totalprecip_mm": 0,
            "maxwind_kph": 10,
            "condition": { "text": "Sunny", "code": 1000 }
          },
          "hour": []
        }
        """;

    private static WeatherService BuildService(FakeHttpMessageHandler handler, string apiKey = "test-key")
    {
        var httpClient = new HttpClient(handler) { BaseAddress = new Uri("https://api.weatherapi.com/v1/") };
        var options = Options.Create(new WeatherApiOptions { ApiKey = apiKey, BaseUrl = "https://api.weatherapi.com/v1/" });
        return new WeatherService(httpClient, options);
    }

    [Fact]
    public async Task GetWeatherAsync_ThrowsWeatherApiException_WhenApiKeyMissing()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK, ForecastResponse(ForecastDayJson));
        var service = BuildService(handler, apiKey: "");

        await Assert.ThrowsAsync<WeatherApiException>(() => service.GetWeatherAsync(51.5, -0.1, 5, CancellationToken.None));
        Assert.Empty(handler.RequestedUris); // fails fast, before any HTTP call
    }

    [Fact]
    public async Task GetWeatherAsync_ThrowsWeatherApiException_WhenUpstreamReturnsError()
    {
        var handler = new FakeHttpMessageHandler(
            HttpStatusCode.BadRequest,
            """{ "error": { "code": 1006, "message": "No matching location found." } }""");
        var service = BuildService(handler);

        var ex = await Assert.ThrowsAsync<WeatherApiException>(() => service.GetWeatherAsync(51.5, -0.1, 0, CancellationToken.None));
        Assert.Equal("No matching location found.", ex.Message);
    }

    [Fact]
    public async Task GetWeatherAsync_NoPastDays_MakesOnlyTheForecastCall()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK, ForecastResponse(ForecastDayJson));
        var service = BuildService(handler);

        var result = await service.GetWeatherAsync(51.5, -0.1, 0, CancellationToken.None);

        Assert.Single(handler.RequestedUris);
        Assert.Contains("forecast.json", handler.RequestedUris[0].ToString());
        Assert.Single(result);
    }

    [Theory]
    [InlineData(30, 1)]  // within one chunk
    [InlineData(31, 1)]  // exactly one chunk (the verified-safe max span)
    [InlineData(32, 2)]  // spills into a second chunk
    [InlineData(92, 3)]  // the frontend's default lookback
    [InlineData(1000, 3)] // clamped to MaxPastDays (92) -> same as 92
    public async Task GetWeatherAsync_ChunksHistoryRequestsAcrossThirtyOneDayWindows(int pastDays, int expectedHistoryCalls)
    {
        var handler = new FakeHttpMessageHandler(request =>
        {
            var isForecast = request.RequestUri!.ToString().Contains("forecast.json");
            var body = isForecast ? ForecastResponse(ForecastDayJson) : ForecastResponse(HistoryDayJson("2026-01-01"));
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body) };
        });
        var service = BuildService(handler);

        await service.GetWeatherAsync(51.5, -0.1, pastDays, CancellationToken.None);

        var historyCalls = handler.RequestedUris.Count(u => u.ToString().Contains("history.json"));
        var forecastCalls = handler.RequestedUris.Count(u => u.ToString().Contains("forecast.json"));
        Assert.Equal(expectedHistoryCalls, historyCalls);
        Assert.Equal(1, forecastCalls);
    }

    [Fact]
    public async Task GetWeatherAsync_MergesForecastAndHistoryResponsesByDate()
    {
        var handler = new FakeHttpMessageHandler(request =>
        {
            var isForecast = request.RequestUri!.ToString().Contains("forecast.json");
            var body = isForecast ? ForecastResponse(ForecastDayJson) : ForecastResponse(HistoryDayJson("2026-08-01"));
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body) };
        });
        var service = BuildService(handler);

        var result = await service.GetWeatherAsync(51.5, -0.1, 5, CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Contains("2026-08-31", result.Keys); // from the forecast fixture
        Assert.Contains("2026-08-01", result.Keys); // from the history fixture
    }

    [Fact]
    public async Task GetWeatherAsync_MapsDayAndHourFieldsFromRawResponse()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK, ForecastResponse(ForecastDayJson));
        var service = BuildService(handler);

        var result = await service.GetWeatherAsync(51.5, -0.1, 0, CancellationToken.None);
        var day = result["2026-08-31"];

        Assert.Equal(1009, day.Code);
        Assert.Equal("Overcast", day.ConditionText);
        Assert.Equal(22.5, day.TempMaxC);
        Assert.Equal(16.3, day.TempMinC);
        Assert.Equal(4.98, day.PrecipitationSumMm);
        Assert.Equal(27, day.WindMaxKmh);
        Assert.Equal(2, day.Hours.Count);

        var hour0 = day.Hours[0];
        Assert.Equal(0, hour0.Hour);
        Assert.Equal(19.4, hour0.TempC);
        Assert.Equal(1009, hour0.Code);
        Assert.Equal(16, hour0.PrecipProbability); // max(chance_of_rain=16, chance_of_snow=0)

        var hour1 = day.Hours[1];
        Assert.Equal(1, hour1.Hour);
        Assert.Equal(45, hour1.PrecipProbability); // max(chance_of_rain=30, chance_of_snow=45)
    }
}
