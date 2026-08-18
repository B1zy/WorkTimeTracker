import { formatDuration } from "./dateUtils";

export const WEEK_TARGET_MINUTES = 42 * 60;
// 42h split evenly across a 5-day work week.
export const DAY_TARGET_MINUTES = WEEK_TARGET_MINUTES / 5;
export const DAY_TARGET_LABEL = `${(DAY_TARGET_MINUTES / 60).toFixed(1)}h`;
// Scale for the gauge meter. Comfortably above target so a slightly "over"
// week still shows headroom in the fill instead of just maxing out.
export const SUMMARY_METER_MAX_MINUTES = 55 * 60;

export type SummaryState = "under" | "target" | "over";

export interface WeekSummary {
  adjustedMinutes: number;
  state: SummaryState;
  label: string;
  fillPercent: number;
}

// Color bands based on how far off the weekly target we are:
//   >50% deviation -> red ("over"), >25% -> orange ("under"), else -> green ("target").
// Note "under"/"over" here name severity tiers, not direction -- a week that's
// over target by 30% still gets the (orange) "under" tier, matching the
// original app's naming.
export function computeWeekSummary(totalMinutes: number, correctionMinutes: number): WeekSummary {
  const adjusted = totalMinutes + correctionMinutes;
  const diff = adjusted - WEEK_TARGET_MINUTES;
  const deviation = Math.abs(diff) / WEEK_TARGET_MINUTES;

  let state: SummaryState;
  let label: string;
  if (deviation > 0.5) {
    state = "over";
    label = `${formatDuration(Math.abs(diff))} ${diff < 0 ? "Under" : "Over"}`;
  } else if (deviation > 0.25) {
    state = "under";
    label = `${formatDuration(Math.abs(diff))} ${diff < 0 ? "Under" : "Over"}`;
  } else if (Math.abs(diff) < 3) {
    state = "target";
    label = "On Target";
  } else {
    state = "target";
    label = `${formatDuration(Math.abs(diff))} ${diff < 0 ? "Under" : "Over"}`;
  }

  return {
    adjustedMinutes: adjusted,
    state,
    label,
    fillPercent: Math.min((adjusted / SUMMARY_METER_MAX_MINUTES) * 100, 100),
  };
}

// The target and scale never change, so this is a plain constant to render.
export function targetMarkerPercent(): number {
  return (WEEK_TARGET_MINUTES / SUMMARY_METER_MAX_MINUTES) * 100;
}
