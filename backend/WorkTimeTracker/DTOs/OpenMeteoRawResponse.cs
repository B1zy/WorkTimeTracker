using System.Text.Json.Serialization;

namespace WorkTimeTracker.DTOs;

// Raw shape for Open-Meteo's forecast endpoint (https://api.open-meteo.com/v1/forecast)
// called with `past_days` -- used only for historical days (see
// WeatherService). Both `daily` and `hourly` are "columnar": each variable
// is its own array, all indexed in parallel against `time` -- not an array
// of per-day/per-hour objects like weatherapi.com's shape.
internal class OpenMeteoRawResponse
{
    [JsonPropertyName("daily")]
    public OpenMeteoDaily? Daily { get; set; }

    [JsonPropertyName("hourly")]
    public OpenMeteoHourly? Hourly { get; set; }
}

internal class OpenMeteoDaily
{
    // "yyyy-MM-dd", one entry per day.
    [JsonPropertyName("time")]
    public List<string> Time { get; set; } = [];

    // Nullable: Open-Meteo's forecast+past_days blend doesn't reliably have
    // data for the whole requested window -- days past roughly the last two
    // months come back as JSON null for every variable rather than the
    // array being shorter. Deserializing that into a non-nullable double
    // throws (and did -- see WeatherService), silently discarding the
    // *entire* response, recent days included. WeatherService skips a day
    // with any null field instead of using it.
    [JsonPropertyName("weather_code")]
    public List<int?> WeatherCode { get; set; } = [];

    [JsonPropertyName("temperature_2m_max")]
    public List<double?> TemperatureMax { get; set; } = [];

    [JsonPropertyName("temperature_2m_min")]
    public List<double?> TemperatureMin { get; set; } = [];

    [JsonPropertyName("precipitation_sum")]
    public List<double?> PrecipitationSum { get; set; } = [];

    [JsonPropertyName("wind_speed_10m_max")]
    public List<double?> WindSpeedMax { get; set; } = [];
}

internal class OpenMeteoHourly
{
    // "yyyy-MM-ddTHH:mm", one entry per hour across the whole requested span.
    [JsonPropertyName("time")]
    public List<string> Time { get; set; } = [];

    // Nullable for the same reason as OpenMeteoDaily's fields above.
    [JsonPropertyName("temperature_2m")]
    public List<double?> Temperature { get; set; } = [];

    [JsonPropertyName("weather_code")]
    public List<int?> WeatherCode { get; set; } = [];
}
