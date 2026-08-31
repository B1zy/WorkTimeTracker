import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchWeatherByDate, type DayWeather } from "../utils/weather";
import { loadWeatherLocation, saveWeatherLocation, type WeatherLocation } from "../utils/weatherLocation";

interface WeatherContextValue {
  location: WeatherLocation | null;
  weatherByDate: Record<string, DayWeather>;
  loading: boolean;
  error: string | null;
  permissionDenied: boolean;
  requestLocation: () => void;
  clearLocation: () => void;
}

const WeatherContext = createContext<WeatherContextValue | null>(null);

// Sessions rarely stay open long enough for a day's forecast to meaningfully
// change, so one fetch per browser tab session (keyed to the location) is
// plenty -- this just avoids re-hitting the backend's weather proxy on every
// remount (e.g. switching between This Week / Overview) within the same session.
const CACHE_PREFIX = "worktimetracker.weatherCache.v1:";

function cacheKey(location: WeatherLocation): string {
  return `${CACHE_PREFIX}${location.lat.toFixed(2)},${location.lon.toFixed(2)}`;
}

function readCache(location: WeatherLocation): Record<string, DayWeather> | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(location));
    return raw ? (JSON.parse(raw) as Record<string, DayWeather>) : null;
  } catch {
    return null;
  }
}

function writeCache(location: WeatherLocation, data: Record<string, DayWeather>): void {
  try {
    sessionStorage.setItem(cacheKey(location), JSON.stringify(data));
  } catch {
    // Storage full or unavailable (private browsing) -- fine to skip caching.
  }
}

export function WeatherProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<WeatherLocation | null>(() => loadWeatherLocation());
  const [weatherByDate, setWeatherByDate] = useState<Record<string, DayWeather>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (!location) {
      setWeatherByDate({});
      return;
    }

    const cached = readCache(location);
    if (cached) {
      setWeatherByDate(cached);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchWeatherByDate(location.lat, location.lon)
      .then((data) => {
        if (cancelled) return;
        setWeatherByDate(data);
        writeCache(location, data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [location]);

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setError("Geolocation isn't supported in this browser.");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: WeatherLocation = { lat: position.coords.latitude, lon: position.coords.longitude };
        saveWeatherLocation(next);
        setPermissionDenied(false);
        setLocation(next);
      },
      (err) => {
        setLoading(false);
        setPermissionDenied(err.code === err.PERMISSION_DENIED);
        setError(err.code === err.PERMISSION_DENIED ? "Location permission denied." : "Couldn't get your location.");
      },
      { maximumAge: 60 * 60 * 1000, timeout: 10000 }
    );
  }

  function clearLocation() {
    saveWeatherLocation(null);
    setLocation(null);
    setWeatherByDate({});
    setError(null);
    setPermissionDenied(false);
  }

  const value = useMemo(
    () => ({ location, weatherByDate, loading, error, permissionDenied, requestLocation, clearLocation }),
    [location, weatherByDate, loading, error, permissionDenied]
  );

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export function useWeather(): WeatherContextValue {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error("useWeather must be used within a WeatherProvider");
  return ctx;
}
