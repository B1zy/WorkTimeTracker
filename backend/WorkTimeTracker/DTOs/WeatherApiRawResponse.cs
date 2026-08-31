using System.Text.Json.Serialization;

namespace WorkTimeTracker.DTOs;

// Raw shapes for weatherapi.com's forecast.json/history.json responses --
// both endpoints share the same forecast/forecastday/day/hour structure, so
// one set of models covers both. Only the fields the app actually uses are
// mapped; everything else in the real response is ignored.
internal class WeatherApiRawResponse
{
    [JsonPropertyName("error")]
    public WeatherApiRawError? Error { get; set; }

    [JsonPropertyName("forecast")]
    public WeatherApiRawForecast? Forecast { get; set; }
}

internal class WeatherApiRawError
{
    [JsonPropertyName("code")]
    public int Code { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;
}

internal class WeatherApiRawForecast
{
    [JsonPropertyName("forecastday")]
    public List<WeatherApiRawForecastDay> ForecastDay { get; set; } = [];
}

internal class WeatherApiRawForecastDay
{
    [JsonPropertyName("date")]
    public string Date { get; set; } = string.Empty;

    [JsonPropertyName("day")]
    public WeatherApiRawDay Day { get; set; } = new();

    [JsonPropertyName("hour")]
    public List<WeatherApiRawHour> Hour { get; set; } = [];
}

internal class WeatherApiRawDay
{
    [JsonPropertyName("maxtemp_c")]
    public double MaxTempC { get; set; }

    [JsonPropertyName("mintemp_c")]
    public double MinTempC { get; set; }

    [JsonPropertyName("totalprecip_mm")]
    public double TotalPrecipMm { get; set; }

    [JsonPropertyName("maxwind_kph")]
    public double MaxWindKph { get; set; }

    [JsonPropertyName("condition")]
    public WeatherApiRawCondition Condition { get; set; } = new();
}

internal class WeatherApiRawHour
{
    // "yyyy-MM-dd HH:mm", local to the queried location.
    [JsonPropertyName("time")]
    public string Time { get; set; } = string.Empty;

    [JsonPropertyName("temp_c")]
    public double TempC { get; set; }

    [JsonPropertyName("condition")]
    public WeatherApiRawCondition Condition { get; set; } = new();

    [JsonPropertyName("chance_of_rain")]
    public double ChanceOfRain { get; set; }

    [JsonPropertyName("chance_of_snow")]
    public double ChanceOfSnow { get; set; }
}

internal class WeatherApiRawCondition
{
    [JsonPropertyName("text")]
    public string Text { get; set; } = string.Empty;

    [JsonPropertyName("code")]
    public int Code { get; set; }
}
