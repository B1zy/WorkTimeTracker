// Where to fetch weather for -- deliberately kept out of AppSettings/backup:
// unlike colors or the weekly target, a coordinate pair is tied to the
// device you granted geolocation on, not a preference that should travel
// with an exported/restored backup onto a different machine.

export interface WeatherLocation {
  lat: number;
  lon: number;
}

const STORAGE_KEY = "worktimetracker.weatherLocation.v1";

export function loadWeatherLocation(): WeatherLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WeatherLocation>;
    if (typeof parsed.lat !== "number" || typeof parsed.lon !== "number") return null;
    return { lat: parsed.lat, lon: parsed.lon };
  } catch {
    return null;
  }
}

export function saveWeatherLocation(location: WeatherLocation | null): void {
  if (location) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}
