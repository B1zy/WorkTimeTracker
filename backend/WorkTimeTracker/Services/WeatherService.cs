using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Options;
using WorkTimeTracker.DTOs;
using WorkTimeTracker.Models;

namespace WorkTimeTracker.Services;

// Two providers, split by what each is actually free for:
//   - weatherapi.com: current conditions + forecast (today through
//     ForecastDays ahead). Its own history.json needs a paid plan -- calling
//     it on a free key is exactly what surfaced as the 502 ("API key is
//     limited to get history data...").
//   - Open-Meteo's forecast endpoint, called with `past_days`: historical
//     days (everything strictly before today). No API key at all needed for
//     non-commercial use -- unlike weatherapi.com's or OpenWeatherMap's paid/
//     card-gated history, there's nothing to sign up for. One call covers
//     the whole `pastDays` window (daily aggregates *and* an hourly
//     breakdown together), rather than one call per day.
// The two are fetched independently, so a problem with one (Open-Meteo
// being unreachable, an unexpected response) can't take down the other --
// forecast still comes back even if history can't.
public class WeatherService : IWeatherService
{
    // weatherapi.com's plan-independent hard cap, confirmed against the
    // configured key: forecast.json never returns more than 14 days no
    // matter what `days` asks for.
    private const int ForecastDays = 14;
    private const int MaxPastDays = 92;

    private readonly HttpClient _httpClient;
    private readonly HttpClient _openMeteoClient;
    private readonly string _apiKey;
    private readonly ILogger<WeatherService> _logger;

    public WeatherService(
        HttpClient httpClient,
        IHttpClientFactory httpClientFactory,
        IOptions<WeatherApiOptions> options,
        ILogger<WeatherService> logger)
    {
        _httpClient = httpClient;
        _openMeteoClient = httpClientFactory.CreateClient("OpenMeteo");
        _apiKey = options.Value.ApiKey;
        _logger = logger;
    }

    public async Task<Dictionary<string, DayWeatherDto>> GetWeatherAsync(double lat, double lon, int pastDays, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            throw new WeatherApiException("Weather API key is not configured.");
        }

        pastDays = Math.Clamp(pastDays, 0, MaxPastDays);
        var location = $"{lat.ToString(CultureInfo.InvariantCulture)},{lon.ToString(CultureInfo.InvariantCulture)}";

        var forecastResponse = await FetchAsync(
            $"forecast.json?key={_apiKey}&q={Uri.EscapeDataString(location)}&days={ForecastDays}&aqi=no&alerts=no",
            cancellationToken);

        var byDate = new Dictionary<string, DayWeatherDto>();
        foreach (var day in forecastResponse.Forecast!.ForecastDay)
        {
            byDate[day.Date] = MapDay(day);
        }

        if (pastDays > 0)
        {
            var historyDays = await FetchOpenMeteoHistoryAsync(lat, lon, pastDays, cancellationToken);
            foreach (var day in historyDays)
            {
                // Never overwrite a forecast day (today) -- history is only
                // ever meant to fill in the days before it.
                byDate.TryAdd(day.DateIso, day);
            }
        }

        return byDate;
    }

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

    // One call for the whole `pastDays` window -- Open-Meteo takes a date
    // *range* (via past_days/forecast_days), not one date per call. Any
    // failure here (unreachable, bad response) is logged and returns an
    // empty list rather than throwing: the frontend already treats a
    // missing day as "no data" (see utils/weather.ts), so history being
    // unavailable shouldn't take the forecast down with it.
    private async Task<List<DayWeatherDto>> FetchOpenMeteoHistoryAsync(double lat, double lon, int pastDays, CancellationToken cancellationToken)
    {
        var url = "forecast"
            + $"?latitude={lat.ToString(CultureInfo.InvariantCulture)}"
            + $"&longitude={lon.ToString(CultureInfo.InvariantCulture)}"
            + $"&past_days={pastDays}&forecast_days=0"
            + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max"
            + "&hourly=temperature_2m,weather_code"
            + "&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm&timezone=auto";

        HttpResponseMessage response;
        try
        {
            response = await _openMeteoClient.GetAsync(url, cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Could not reach Open-Meteo for historical weather.");
            return [];
        }

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Open-Meteo history request failed ({Status}).", (int)response.StatusCode);
            return [];
        }

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        OpenMeteoRawResponse? parsed;
        try
        {
            parsed = JsonSerializer.Deserialize<OpenMeteoRawResponse>(body);
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Open-Meteo returned an unexpected response.");
            return [];
        }
        if (parsed?.Daily is null) return [];

        var hoursByDate = GroupHoursByDate(parsed.Hourly);

        // Belt-and-braces alongside byDate.TryAdd in GetWeatherAsync: even
        // with forecast_days=0, only ever accept a date strictly before
        // today here too, in case of a timezone edge case at the boundary.
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var results = new List<DayWeatherDto>();
        for (var i = 0; i < parsed.Daily.Time.Count; i++)
        {
            var dateIso = parsed.Daily.Time[i];
            if (!DateOnly.TryParse(dateIso, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date) || date >= today) continue;

            var wmoCode = GetOrDefault(parsed.Daily.WeatherCode, i);
            var tempMax = GetOrDefault(parsed.Daily.TemperatureMax, i);
            var tempMin = GetOrDefault(parsed.Daily.TemperatureMin, i);
            var precipitation = GetOrDefault(parsed.Daily.PrecipitationSum, i);
            var windMax = GetOrDefault(parsed.Daily.WindSpeedMax, i);
            // A day this far back that Open-Meteo genuinely has no reading
            // for yet (see the nullable comment on OpenMeteoDaily) -- skip
            // it rather than fabricate zeros from a missing value; same
            // "no data" handling as a date outside the window entirely.
            if (wmoCode is null || tempMax is null || tempMin is null || precipitation is null || windMax is null) continue;

            var (code, text) = MapWeatherCode(wmoCode.Value);
            results.Add(new DayWeatherDto
            {
                DateIso = dateIso,
                Code = code,
                ConditionText = text,
                TempMaxC = tempMax.Value,
                TempMinC = tempMin.Value,
                PrecipitationSumMm = precipitation.Value,
                WindMaxKmh = windMax.Value,
                Hours = hoursByDate.TryGetValue(dateIso, out var hours) ? hours : [],
            });
        }
        return results;
    }

    // Open-Meteo's hourly section is one flat array covering the whole
    // requested span ("2026-08-31T00:00", "2026-08-31T01:00", ..., into the
    // next day) -- this splits it back into per-day lists keyed by the date
    // portion, so each day's Hours only holds its own 24.
    private static Dictionary<string, List<HourWeatherDto>> GroupHoursByDate(OpenMeteoHourly? hourly)
    {
        var byDate = new Dictionary<string, List<HourWeatherDto>>();
        if (hourly is null) return byDate;

        for (var i = 0; i < hourly.Time.Count; i++)
        {
            var temp = GetOrDefault(hourly.Temperature, i);
            var wmoCode = GetOrDefault(hourly.WeatherCode, i);
            if (temp is null || wmoCode is null) continue; // no reading for this hour yet -- see OpenMeteoHourly

            var parts = hourly.Time[i].Split('T');
            if (parts.Length != 2) continue;
            var date = parts[0];
            var hour = int.TryParse(parts[1].AsSpan(0, 2), NumberStyles.Integer, CultureInfo.InvariantCulture, out var h) ? h : 0;

            if (!byDate.TryGetValue(date, out var list))
            {
                list = [];
                byDate[date] = list;
            }

            var (code, _) = MapWeatherCode(wmoCode.Value);
            list.Add(new HourWeatherDto
            {
                Hour = hour,
                TempC = temp.Value,
                Code = code,
                // Open-Meteo's `past_days` gives observed (not forecast)
                // weather here -- there's no meaningful "chance of rain"
                // for something that already happened, unlike weatherapi.com's
                // forecast hours.
                PrecipProbability = null,
            });
        }
        return byDate;
    }

    private static T? GetOrDefault<T>(List<T?> list, int index) where T : struct => index < list.Count ? list[index] : null;

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

    // Open-Meteo reports the WMO weather code (https://open-meteo.com/en/docs,
    // "WMO Weather interpretation codes") -- a completely different scheme
    // from weatherapi.com's. This maps each WMO code to one of weatherapi.com's
    // own codes (see the frontend's utils/weather.ts, which maps *those* to
    // icons), so a history day's icon comes from the same icon set a
    // forecast day uses.
    private static (int Code, string Text) MapWeatherCode(int wmoCode) => wmoCode switch
    {
        0 => (1000, "Clear"),
        1 => (1000, "Mainly clear"),
        2 => (1003, "Partly cloudy"),
        3 => (1006, "Overcast"),
        45 or 48 => (1030, "Fog"),
        51 or 53 or 55 => (1150, "Drizzle"),
        56 or 57 => (1168, "Freezing drizzle"),
        61 => (1180, "Light rain"),
        63 => (1189, "Moderate rain"),
        65 => (1195, "Heavy rain"),
        66 or 67 => (1198, "Freezing rain"),
        71 => (1213, "Light snow"),
        73 => (1219, "Moderate snow"),
        75 => (1225, "Heavy snow"),
        77 => (1237, "Snow grains"),
        80 => (1240, "Light rain showers"),
        81 => (1243, "Moderate rain showers"),
        82 => (1246, "Heavy rain showers"),
        85 => (1255, "Light snow showers"),
        86 => (1258, "Heavy snow showers"),
        95 => (1087, "Thunderstorm"),
        96 or 99 => (1273, "Thunderstorm with hail"),
        _ => (1006, "Unknown"),
    };
}
