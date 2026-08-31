// Wrapper around the backend's weather proxy (see workSessions.ts for the
// matching pattern). The backend holds the weatherapi.com key server-side --
// the frontend never talks to weatherapi.com directly.

import type { DayWeather } from "../utils/weather";

const BASE_URL = import.meta.env.VITE_WEATHER_API_BASE_URL ?? "http://localhost:5149/api/Weather";

// GET /api/Weather?lat=...&lon=...&pastDays=...
export async function getWeatherByDate(lat: number, lon: number, pastDays: number): Promise<Record<string, DayWeather>> {
  const url = `${BASE_URL}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&pastDays=${encodeURIComponent(pastDays)}`;
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Weather request failed (${response.status}): ${text}`);
  }
  return response.json();
}
