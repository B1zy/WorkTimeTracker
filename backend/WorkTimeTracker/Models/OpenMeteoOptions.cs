namespace WorkTimeTracker.Models;

// Bound from the "OpenMeteo" config section. Used only for historical
// weather (see WeatherService) -- weatherapi.com still covers current/
// forecast. Unlike weatherapi.com's history.json (paid-only) or
// OpenWeatherMap's history endpoints (free tier requires a card on file),
// Open-Meteo's API needs no key at all for non-commercial use -- so there's
// no ApiKey property here, just the base URL, and nothing to set up via
// user-secrets.
public class OpenMeteoOptions
{
    public string BaseUrl { get; set; } = "https://api.open-meteo.com/v1/";
}
