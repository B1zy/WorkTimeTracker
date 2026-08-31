using WorkTimeTracker.DTOs;

namespace WorkTimeTracker.Services;

public interface IWeatherService
{
    // Keyed by ISO date ("yyyy-MM-dd"), covering `pastDays` days before today
    // through weatherapi.com's forecast horizon (14 days, its hard cap --
    // requesting more doesn't get you more).
    Task<Dictionary<string, DayWeatherDto>> GetWeatherAsync(double lat, double lon, int pastDays, CancellationToken cancellationToken);
}
