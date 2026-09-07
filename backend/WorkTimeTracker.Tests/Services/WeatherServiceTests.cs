using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
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

    // One Open-Meteo response covering `dates` -- daily aggregates plus two
    // hourly entries per day (enough to prove per-day grouping works
    // without a huge fixture).
    private static string OpenMeteoResponse(
        IReadOnlyList<string> dates,
        int weatherCode = 3,
        double tempMax = 15,
        double tempMin = 5,
        double precipitationSum = 0,
        double windMax = 10)
    {
        var dailyTime = string.Join(",", dates.Select(d => $"\"{d}\""));
        var dailyCodes = string.Join(",", dates.Select(_ => weatherCode));
        var dailyMax = string.Join(",", dates.Select(_ => tempMax));
        var dailyMin = string.Join(",", dates.Select(_ => tempMin));
        var dailyPrecip = string.Join(",", dates.Select(_ => precipitationSum));
        var dailyWind = string.Join(",", dates.Select(_ => windMax));

        var hourlyTime = string.Join(",", dates.SelectMany(d => new[] { $"\"{d}T00:00\"", $"\"{d}T12:00\"" }));
        var hourlyTemp = string.Join(",", dates.SelectMany(_ => new[] { tempMin, tempMax }));
        var hourlyCodes = string.Join(",", dates.SelectMany(_ => new[] { weatherCode, weatherCode }));

        return $$"""
            {
              "daily": {
                "time": [{{dailyTime}}],
                "weather_code": [{{dailyCodes}}],
                "temperature_2m_max": [{{dailyMax}}],
                "temperature_2m_min": [{{dailyMin}}],
                "precipitation_sum": [{{dailyPrecip}}],
                "wind_speed_10m_max": [{{dailyWind}}]
              },
              "hourly": {
                "time": [{{hourlyTime}}],
                "temperature_2m": [{{hourlyTemp}}],
                "weather_code": [{{hourlyCodes}}]
              }
            }
            """;
    }

    private static WeatherService BuildService(FakeHttpMessageHandler handler, string apiKey = "test-key")
    {
        var httpClient = new HttpClient(handler) { BaseAddress = new Uri("https://api.weatherapi.com/v1/") };
        var openMeteoClient = new HttpClient(handler) { BaseAddress = new Uri("https://api.open-meteo.com/v1/") };
        var options = Options.Create(new WeatherApiOptions { ApiKey = apiKey, BaseUrl = "https://api.weatherapi.com/v1/" });
        return new WeatherService(httpClient, new FakeHttpClientFactory(openMeteoClient), options, NullLogger<WeatherService>.Instance);
    }

    private static string[] PastDates(int pastDays)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return Enumerable.Range(1, pastDays).Select(offset => today.AddDays(-offset).ToString("yyyy-MM-dd")).ToArray();
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
    [InlineData(1)]
    [InlineData(5)]
    [InlineData(92)] // the frontend's default lookback
    [InlineData(1000)] // clamped to MaxPastDays (92) -> same as 92
    public async Task GetWeatherAsync_MakesExactlyOneOpenMeteoCallRegardlessOfPastDays(int pastDays)
    {
        var dates = PastDates(Math.Min(pastDays, 92));
        var handler = new FakeHttpMessageHandler(request =>
        {
            var isForecast = request.RequestUri!.ToString().Contains("forecast.json");
            var body = isForecast ? ForecastResponse(ForecastDayJson) : OpenMeteoResponse(dates);
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body) };
        });
        var service = BuildService(handler);

        var result = await service.GetWeatherAsync(51.5, -0.1, pastDays, CancellationToken.None);

        var openMeteoCalls = handler.RequestedUris.Count(u => u.Host.Contains("open-meteo"));
        var forecastCalls = handler.RequestedUris.Count(u => u.ToString().Contains("forecast.json"));
        Assert.Equal(1, openMeteoCalls); // one call for the whole window, not one per day
        Assert.Equal(1, forecastCalls);
        // Not a fixed total: the forecast fixture's hardcoded date could, in
        // principle, land inside the (test-run-time-relative) history
        // window and collide with one of the keys below -- checking every
        // expected key is present is robust either way, a total count isn't.
        Assert.Contains("2026-08-31", result.Keys);
        foreach (var date in dates)
        {
            Assert.Contains(date, result.Keys);
        }
    }

    [Fact]
    public async Task GetWeatherAsync_MergesForecastAndOpenMeteoHistoryByDate()
    {
        var dates = PastDates(5);
        var handler = new FakeHttpMessageHandler(request =>
        {
            var isForecast = request.RequestUri!.ToString().Contains("forecast.json");
            var body = isForecast ? ForecastResponse(ForecastDayJson) : OpenMeteoResponse(dates);
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body) };
        });
        var service = BuildService(handler);

        var result = await service.GetWeatherAsync(51.5, -0.1, 5, CancellationToken.None);

        Assert.Contains("2026-08-31", result.Keys); // from the forecast fixture
        foreach (var date in dates)
        {
            Assert.Contains(date, result.Keys);
        }
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

    [Theory]
    [InlineData(0, 1000, "Clear")]
    [InlineData(3, 1006, "Overcast")]
    [InlineData(61, 1180, "Light rain")]
    [InlineData(75, 1225, "Heavy snow")]
    [InlineData(95, 1087, "Thunderstorm")]
    public async Task GetWeatherAsync_MapsWmoWeatherCodeToWeatherApiCode(int wmoCode, int expectedCode, string expectedText)
    {
        var dates = PastDates(1);
        var handler = new FakeHttpMessageHandler(request =>
        {
            var isForecast = request.RequestUri!.ToString().Contains("forecast.json");
            var body = isForecast ? ForecastResponse(ForecastDayJson) : OpenMeteoResponse(dates, weatherCode: wmoCode);
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body) };
        });
        var service = BuildService(handler);

        var result = await service.GetWeatherAsync(51.5, -0.1, 1, CancellationToken.None);
        var day = result[dates[0]];

        Assert.Equal(expectedCode, day.Code);
        Assert.Equal(expectedText, day.ConditionText);
    }

    [Fact]
    public async Task GetWeatherAsync_MapsOpenMeteoDailyFieldsAndGroupsHoursByDate()
    {
        var dates = PastDates(2);
        var handler = new FakeHttpMessageHandler(request =>
        {
            var isForecast = request.RequestUri!.ToString().Contains("forecast.json");
            var body = isForecast
                ? ForecastResponse(ForecastDayJson)
                : OpenMeteoResponse(dates, tempMax: 18.5, tempMin: 6.2, precipitationSum: 3.4, windMax: 22);
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body) };
        });
        var service = BuildService(handler);

        var result = await service.GetWeatherAsync(51.5, -0.1, 2, CancellationToken.None);
        var day = result[dates[0]];

        Assert.Equal(18.5, day.TempMaxC);
        Assert.Equal(6.2, day.TempMinC);
        Assert.Equal(3.4, day.PrecipitationSumMm);
        Assert.Equal(22, day.WindMaxKmh); // already km/h -- no unit conversion needed
        Assert.Equal(2, day.Hours.Count); // this day's 2 hourly entries, not the other day's
        Assert.All(day.Hours, h => Assert.Null(h.PrecipProbability)); // no probability for observed history
    }

    // Reproduces a real bug: Open-Meteo's forecast+past_days blend doesn't
    // reliably have data for the whole requested window -- days past
    // roughly the last two months come back as JSON null for every daily
    // variable (not a shorter array). Deserializing that into non-nullable
    // doubles/ints used to throw, discarding the *entire* response,
    // including the days that did have real data.
    [Fact]
    public async Task GetWeatherAsync_SkipsNullHistoryDaysAndHours_WithoutLosingTheRest()
    {
        var dates = PastDates(2);
        var oldDate = dates[0]; // no data available for this one
        var recentDate = dates[1]; // has data, but one of its two hours doesn't

        var body = $$"""
            {
              "daily": {
                "time": ["{{oldDate}}", "{{recentDate}}"],
                "weather_code": [null, 2],
                "temperature_2m_max": [null, 14.5],
                "temperature_2m_min": [null, 6.1],
                "precipitation_sum": [null, 0.4],
                "wind_speed_10m_max": [null, 12]
              },
              "hourly": {
                "time": ["{{oldDate}}T00:00", "{{recentDate}}T00:00", "{{recentDate}}T12:00"],
                "temperature_2m": [null, 7.2, null],
                "weather_code": [null, 2, 2]
              }
            }
            """;

        var handler = new FakeHttpMessageHandler(request =>
        {
            var isForecast = request.RequestUri!.ToString().Contains("forecast.json");
            var responseBody = isForecast ? ForecastResponse(ForecastDayJson) : body;
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(responseBody) };
        });
        var service = BuildService(handler);

        var result = await service.GetWeatherAsync(51.5, -0.1, 2, CancellationToken.None);

        Assert.Contains("2026-08-31", result.Keys); // forecast day, unaffected
        Assert.DoesNotContain(oldDate, result.Keys); // no data at all -- skipped, not fabricated
        Assert.Contains(recentDate, result.Keys); // has data -- not lost just because oldDate didn't

        var day = result[recentDate];
        Assert.Equal(14.5, day.TempMaxC);
        Assert.Single(day.Hours); // the null 12:00 hour is skipped, the valid 00:00 one isn't
        Assert.Equal(0, day.Hours[0].Hour);
        Assert.Equal(7.2, day.Hours[0].TempC);
    }

    [Fact]
    public async Task GetWeatherAsync_SkipsHistory_WhenOpenMeteoRequestFails()
    {
        var handler = new FakeHttpMessageHandler(request =>
        {
            var uri = request.RequestUri!.ToString();
            if (uri.Contains("forecast.json")) return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(ForecastResponse(ForecastDayJson)) };
            return new HttpResponseMessage(HttpStatusCode.ServiceUnavailable);
        });
        var service = BuildService(handler);

        var result = await service.GetWeatherAsync(51.5, -0.1, 5, CancellationToken.None);

        Assert.Single(result); // forecast day only; the whole request still succeeds
        Assert.Contains("2026-08-31", result.Keys);
    }
}
