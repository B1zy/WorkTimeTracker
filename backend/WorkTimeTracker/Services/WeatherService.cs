using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Options;
using WorkTimeTracker.DTOs;
using WorkTimeTracker.Models;

namespace WorkTimeTracker.Services;

public class WeatherService : IWeatherService
{
    // weatherapi.com's plan-independent hard caps, confirmed against the
    // configured key: forecast.json never returns more than 14 days no matter
    // what `days` asks for, and history.json rejects a dt/end_dt span over
    // 31 days (code 1008), so a longer lookback has to be split into chunks.
    private const int ForecastDays = 14;
    private const int MaxPastDays = 92;
    private const int HistoryChunkDays = 31;

    private readonly HttpClient _httpClient;
    private readonly string _apiKey;

    public WeatherService(HttpClient httpClient, IOptions<WeatherApiOptions> options)
    {
        _httpClient = httpClient;
        _apiKey = options.Value.ApiKey;
    }

    public async Task<Dictionary<string, DayWeatherDto>> GetWeatherAsync(double lat, double lon, int pastDays, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            throw new WeatherApiException("Weather API key is not configured.");
        }

        pastDays = Math.Clamp(pastDays, 0, MaxPastDays);
        var location = $"{lat.ToString(CultureInfo.InvariantCulture)},{lon.ToString(CultureInfo.InvariantCulture)}";

        var fetches = new List<Task<WeatherApiRawResponse>>
        {
            FetchAsync($"forecast.json?key={_apiKey}&q={Uri.EscapeDataString(location)}&days={ForecastDays}&aqi=no&alerts=no", cancellationToken),
        };
        fetches.AddRange(BuildHistoryChunks(pastDays).Select(chunk =>
            FetchAsync(
                $"history.json?key={_apiKey}&q={Uri.EscapeDataString(location)}&dt={Fmt(chunk.start)}&end_dt={Fmt(chunk.end)}",
                cancellationToken)));

        var responses = await Task.WhenAll(fetches);

        var byDate = new Dictionary<string, DayWeatherDto>();
        foreach (var response in responses)
        {
            foreach (var day in response.Forecast!.ForecastDay)
            {
                byDate[day.Date] = MapDay(day);
            }
        }
        return byDate;
    }

    // Splits [today-pastDays, yesterday] into <= HistoryChunkDays windows.
    private static IEnumerable<(DateOnly start, DateOnly end)> BuildHistoryChunks(int pastDays)
    {
        if (pastDays == 0) yield break;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var rangeStart = today.AddDays(-pastDays);
        var rangeEnd = today.AddDays(-1);

        var chunkStart = rangeStart;
        while (chunkStart <= rangeEnd)
        {
            var chunkEnd = chunkStart.AddDays(HistoryChunkDays - 1);
            if (chunkEnd > rangeEnd) chunkEnd = rangeEnd;
            yield return (chunkStart, chunkEnd);
            chunkStart = chunkEnd.AddDays(1);
        }
    }

    private static string Fmt(DateOnly date) => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    private async Task<WeatherApiRawResponse> FetchAsync(string relativeUrl, CancellationToken cancellationToken)
    {
        HttpResponseMessage response;
        try
        {
            response = await _httpClient.GetAsync(relativeUrl, cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            throw new WeatherApiException($"Could not reach the weather service: {ex.Message}");
        }

        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        WeatherApiRawResponse? parsed;
        try
        {
            parsed = JsonSerializer.Deserialize<WeatherApiRawResponse>(body);
        }
        catch (JsonException)
        {
            throw new WeatherApiException("Weather service returned an unexpected response.");
        }

        if (parsed?.Error is not null)
        {
            throw new WeatherApiException(parsed.Error.Message);
        }
        if (!response.IsSuccessStatusCode || parsed?.Forecast is null)
        {
            throw new WeatherApiException($"Weather service request failed ({(int)response.StatusCode}).");
        }

        return parsed;
    }

    private static DayWeatherDto MapDay(WeatherApiRawForecastDay day) => new()
    {
        DateIso = day.Date,
        Code = day.Day.Condition.Code,
        ConditionText = day.Day.Condition.Text,
        TempMaxC = day.Day.MaxTempC,
        TempMinC = day.Day.MinTempC,
        PrecipitationSumMm = day.Day.TotalPrecipMm,
        WindMaxKmh = day.Day.MaxWindKph,
        Hours = day.Hour.Select(MapHour).ToList(),
    };

    private static HourWeatherDto MapHour(WeatherApiRawHour hour) => new()
    {
        Hour = ParseHour(hour.Time),
        TempC = hour.TempC,
        Code = hour.Condition.Code,
        PrecipProbability = Math.Max(hour.ChanceOfRain, hour.ChanceOfSnow),
    };

    // hour.Time is "yyyy-MM-dd HH:mm"; only the hour-of-day is needed.
    private static int ParseHour(string time) =>
        DateTime.TryParse(time, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed) ? parsed.Hour : 0;
}
