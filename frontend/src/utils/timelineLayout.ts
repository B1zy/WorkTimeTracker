// Shared layout constants/helpers for the timeline track, axis, and blocks.

import type { EntryType, WorkLocation } from "../types/WorkSession";

// Absolute bounds: a session can never exist outside an actual day,
// regardless of how much of it the timebar is currently showing.
export const ABS_DAY_START_MIN = 0;
export const ABS_DAY_END_MIN = 24 * 60;

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

// "Working" sessions are colored by location (see LOCATION_CLASS above);
// every other entry type overrides the block color instead, since location
// isn't meaningful for e.g. a sick day.
export const ENTRY_TYPE_CLASS: Record<EntryType, string | null> = {
  Working: null,
  Sick: "type-sick",
  OvertimeCompensation: "type-overtime-compensation",
  Appointment: "type-appointment",
  Lunch: "type-lunch",
};

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  Working: "Working",
  Sick: "Sick",
  OvertimeCompensation: "Overtime Compensation",
  Appointment: "Appointment",
  Lunch: "Lunch",
};

// Minutes-since-midnight -> left-offset percentage along the visible timebar
// range, clamped to [0, 100].
export function minutesToPercent(minutes: number, rangeStartMin: number, rangeEndMin: number): number {
  const clamped = Math.min(Math.max(minutes, rangeStartMin), rangeEndMin);
  return ((clamped - rangeStartMin) / (rangeEndMin - rangeStartMin)) * 100;
}

// "HH:MM:00" -> minutes since midnight, rounded to the nearest 5.
export function snapMinutesTo5(mins: number): number {
  return Math.round(mins / 5) * 5;
}

export function minsToTimeStr(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}:00`;
}

export interface MinuteInterval {
  start: number;
  end: number;
}

// The end of the nearest sibling session that finishes at or before
// `startMins` -- how far left a block (or its start-edge, when resizing) can
// go before it would overlap another session.
export function nearestLeftBoundary(startMins: number, siblings: MinuteInterval[], rangeStartMin: number): number {
  const ends = siblings.filter((s) => s.end <= startMins).map((s) => s.end);
  return ends.length ? Math.max(...ends) : rangeStartMin;
}

// The start of the nearest sibling session that begins at or after
// `endMins` -- how far right a block (or its end-edge) can go.
export function nearestRightBoundary(endMins: number, siblings: MinuteInterval[], rangeEndMin: number): number {
  const starts = siblings.filter((s) => s.start >= endMins).map((s) => s.start);
  return starts.length ? Math.min(...starts) : rangeEndMin;
}

// When a dragged move overlaps another session, slide it just up against the
// nearest blocking edge in the direction it was dragged (rather than
// reverting all the way back to where it started). Returns null if no valid
// slot exists in that direction (e.g. wedged between two other sessions with
// no room left).
export function snapToNearestFreeSlot(
  candidateStartMins: number,
  durationMins: number,
  originalStartMins: number,
  siblings: MinuteInterval[],
  rangeStartMin: number = ABS_DAY_START_MIN,
  rangeEndMin: number = ABS_DAY_END_MIN
): MinuteInterval | null {
  let start = candidateStartMins;
  const movingRight = start > originalStartMins;
  const sorted = [...siblings].sort((a, b) => a.start - b.start);

  for (let guard = 0; guard <= sorted.length; guard++) {
    const end = start + durationMins;
    const blocker = sorted.find((iv) => start < iv.end && iv.start < end);
    if (!blocker) break;
    start = movingRight ? blocker.end : blocker.start - durationMins;
  }

  const end = start + durationMins;
  if (start < rangeStartMin || end > rangeEndMin) return null;
  if (sorted.some((iv) => start < iv.end && iv.start < end)) return null;
  return { start, end };
}

// Ruler ticks for the timeline axis, generalized from the original fixed
// 6h-major/3h-minor cadence to any visible [startMin, endMin] range: major
// ticks split the range into ~4 hour-aligned segments, minor ticks sit at
// each segment's midpoint.
export function generateAxisTicks(startMin: number, endMin: number): { majorMins: number[]; minorMins: number[] } {
  const rangeMin = endMin - startMin;
  const majorStepMin = Math.max(60, Math.round(rangeMin / 4 / 60) * 60);

  const majorMins: number[] = [];
  for (let m = startMin; m < endMin; m += majorStepMin) majorMins.push(m);
  majorMins.push(endMin);

  const minorMins: number[] = [];
  for (let i = 0; i < majorMins.length - 1; i++) {
    minorMins.push(Math.round((majorMins[i] + majorMins[i + 1]) / 2));
  }

  return { majorMins, minorMins };
}
