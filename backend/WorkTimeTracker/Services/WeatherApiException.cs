namespace WorkTimeTracker.Services;

// Thrown when weatherapi.com itself reports a problem (bad location, bad key,
// plan limits, etc.) or the HTTP call to it otherwise fails. Kept distinct
// from other exceptions so the controller can map it to a 502 instead of
// falling through to the generic 500 handler.
public class WeatherApiException(string message) : Exception(message);
