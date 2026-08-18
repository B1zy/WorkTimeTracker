// Shared layout constants/helpers for the timeline track, axis, and blocks.

import type { WorkLocation } from "../types/WorkSession";

// The timeline always spans the full day so a session late at night can
// never render outside the row.
export const DAY_START_MIN = 0;
export const DAY_END_MIN = 24 * 60;
export const DAY_RANGE_MIN = DAY_END_MIN - DAY_START_MIN;

// Ruler ticks: major (labeled) every 6h, minor (unlabeled) every 3h in between.
export const MAJOR_HOURS = [0, 6, 12, 18, 24];
export const MINOR_HOURS = [3, 9, 15, 21];

export const LOCATION_CLASS: Record<WorkLocation, string> = {
  Remote: "loc-remote",
  InOffice: "loc-inoffice",
  Other: "loc-other",
};

export const LOCATION_LABEL: Record<WorkLocation, string> = {
  Remote: "Remote",
  InOffice: "In Office",
  Other: "Other",
};

// Minutes-since-midnight -> left-offset percentage along the timeline,
// clamped to [0, 100] as a safety net (the range already covers the full day).
export function minutesToPercent(minutes: number): number {
  const clamped = Math.min(Math.max(minutes, DAY_START_MIN), DAY_END_MIN);
  return ((clamped - DAY_START_MIN) / DAY_RANGE_MIN) * 100;
}

// "HH:MM:00" -> minutes since midnight, rounded to the nearest 5.
export function snapMinutesTo5(mins: number): number {
  return Math.round(mins / 5) * 5;
}

export function minsToTimeStr(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}:00`;
}
