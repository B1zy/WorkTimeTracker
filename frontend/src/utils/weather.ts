// Weather is proxied through the app's own backend, which calls weatherapi.com
// (the key stays server-side -- see api/weather.ts and the backend's
// WeatherService). past days / forecast days cap the window at ~3 months back
// to 14 days ahead (weatherapi.com's own hard limits); days outside that just
// don't have an entry in the returned map, and callers treat a missing day as
// "no data" rather than an error.

import { getWeatherByDate } from "../api/weather";

export type WeatherIconKind = "clear" | "partly-cloudy" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "thunderstorm";

// weatherapi.com condition codes (https://www.weatherapi.com/docs/weather_conditions.json),
// collapsed down to this app's icon set. Same code is used day and night --
// WeatherIcon doesn't have night variants.
const CLEAR_CODES = [1000];
const PARTLY_CLOUDY_CODES = [1003];
const CLOUDY_CODES = [1006, 1009];
const FOG_CODES = [1030, 1135, 1147];
const DRIZZLE_CODES = [1063, 1072, 1150, 1153, 1168, 1171];
const RAIN_CODES = [1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201, 1240, 1243, 1246];
const SNOW_CODES = [
  1066, 1069, 1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264,
];
const THUNDERSTORM_CODES = [1087, 1273, 1276, 1279, 1282];

export function weatherIconKind(code: number): WeatherIconKind {
  if (CLEAR_CODES.includes(code)) return "clear";
  if (PARTLY_CLOUDY_CODES.includes(code)) return "partly-cloudy";
  if (FOG_CODES.includes(code)) return "fog";
  if (DRIZZLE_CODES.includes(code)) return "drizzle";
  if (RAIN_CODES.includes(code)) return "rain";
  if (SNOW_CODES.includes(code)) return "snow";
  if (THUNDERSTORM_CODES.includes(code)) return "thunderstorm";
  if (CLOUDY_CODES.includes(code)) return "cloudy";
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
  // weatherapi.com's own human-readable label for `code` (e.g. "Patchy rain
  // possible") -- used directly instead of maintaining a parallel label table.
  conditionText: string;
  tempMaxC: number;
  tempMinC: number;
  precipitationSumMm: number;
  windMaxKmh: number;
  hours: HourWeather[];
}

const PAST_DAYS = 92;

export async function fetchWeatherByDate(lat: number, lon: number): Promise<Record<string, DayWeather>> {
  return getWeatherByDate(lat, lon, PAST_DAYS);
}
