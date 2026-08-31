namespace WorkTimeTracker.DTOs;

// Response contract for GET /api/Weather -- mirrors the frontend's
// DayWeather/HourWeather shape (utils/weather.ts) so the client-side mapping
// stays a straight pass-through.
public class DayWeatherDto
{
    public string DateIso { get; set; } = string.Empty;
    public int Code { get; set; }
    public string ConditionText { get; set; } = string.Empty;
    public double TempMaxC { get; set; }
    public double TempMinC { get; set; }
    public double PrecipitationSumMm { get; set; }
    public double WindMaxKmh { get; set; }
    public List<HourWeatherDto> Hours { get; set; } = [];
}

public class HourWeatherDto
{
    public int Hour { get; set; }
    public double TempC { get; set; }
    public int Code { get; set; }
    public double? PrecipProbability { get; set; }
}
