namespace WorkTimeTracker.Models;

// Bound from the "WeatherApi" config section. ApiKey deliberately has no
// default and isn't set in appsettings*.json -- it's supplied via
// `dotnet user-secrets` in development or an environment variable
// (WeatherApi__ApiKey) elsewhere, so it never ends up committed to the repo.
public class WeatherApiOptions
{
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.weatherapi.com/v1/";
}
