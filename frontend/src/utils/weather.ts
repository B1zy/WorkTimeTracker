// Open-Meteo (open-meteo.com) -- a free forecast API that needs no API key
// and allows direct browser fetches (CORS-enabled), which is why weather
// isn't proxied through the app's own backend. past_days/forecast_days cap
// the window at ~3 months back to 16 days ahead; days outside that just
// don't have an entry in the returned map, and callers treat a missing day
// as "no data" rather than an error.

export type WeatherIconKind = "clear" | "partly-cloudy" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "thunderstorm";

// WMO weather interpretation codes, as used by Open-Meteo's `weathercode`.
export const WEATHER_CODE_LABEL: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Freezing drizzle",
  61: "Slight rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Freezing rain",
  71: "Slight snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with heavy hail",
};

export function weatherCodeLabel(code: number): string {
  return WEATHER_CODE_LABEL[code] ?? "Unknown";
}

export function weatherIconKind(code: number): WeatherIconKind {
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly-cloudy";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "thunderstorm";
  return "cloudy";
}

export interface HourWeather {
  hour: number;
  tempC: number;
  code: number;
  precipProbability: number | null;
}

export interface DayWeather {
  dateIso: string;
  code: number;
  tempMaxC: number;
  tempMinC: number;
  precipitationSumMm: number;
  windMaxKmh: number;
  hours: HourWeather[];
}

const FORECAST_BASE_URL = "https://api.open-meteo.com/v1/forecast";
const PAST_DAYS = 92;
const FORECAST_DAYS = 16;

interface OpenMeteoResponse {
  daily?: {
    time: string[];
    weathercode: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    windspeed_10m_max: number[];
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    weathercode: number[];
    precipitation_probability: number[];
  };
}

export async function fetchWeatherByDate(lat: number, lon: number): Promise<Record<string, DayWeather>> {
  const url =
    `${FORECAST_BASE_URL}?latitude=${lat}&longitude=${lon}` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max` +
    `&hourly=temperature_2m,weathercode,precipitation_probability` +
    `&timezone=auto&past_days=${PAST_DAYS}&forecast_days=${FORECAST_DAYS}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
  const data = (await response.json()) as OpenMeteoResponse;
  if (!data.daily) throw new Error("Weather response missing daily data");

  const byDate: Record<string, DayWeather> = {};
  data.daily.time.forEach((dateIso, i) => {
    byDate[dateIso] = {
      dateIso,
      code: data.daily!.weathercode[i],
      tempMaxC: data.daily!.temperature_2m_max[i],
      tempMinC: data.daily!.temperature_2m_min[i],
      precipitationSumMm: data.daily!.precipitation_sum[i],
      windMaxKmh: data.daily!.windspeed_10m_max[i],
      hours: [],
    };
  });

  if (data.hourly) {
    data.hourly.time.forEach((timeIso, i) => {
      const [dateIso, time] = timeIso.split("T");
      const day = byDate[dateIso];
      if (!day) return;
      day.hours.push({
        hour: Number(time.slice(0, 2)),
        tempC: data.hourly!.temperature_2m[i],
        code: data.hourly!.weathercode[i],
        precipProbability: data.hourly!.precipitation_probability?.[i] ?? null,
      });
    });
  }

  return byDate;
}
