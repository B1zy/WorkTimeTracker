import { formatDuration } from "./dateUtils";

export type SummaryState = "under" | "target" | "over";

export interface WeekSummary {
  adjustedMinutes: number;
  state: SummaryState;
  label: string;
  fillPercent: number;
}

// Meter headroom above target so a slightly "over" week still shows some
// fill room instead of just maxing out. Matches the original app's 42/55
// ratio (~31% headroom).
const METER_HEADROOM_RATIO = 13 / 42;

export function meterMaxMinutes(weekTargetMinutes: number): number {
  return weekTargetMinutes * (1 + METER_HEADROOM_RATIO);
}

// The weekly target split evenly across however many work days are active.
// `workdayCount` is guaranteed >= 1 by sanitizeWorkdays, but guard anyway --
// a zero here would silently produce an Infinity target.
export function dayTargetMinutes(weekTargetMinutes: number, workdayCount: number): number {
  return weekTargetMinutes / Math.max(workdayCount, 1);
}

export function dayTargetLabel(weekTargetMinutes: number, workdayCount: number): string {
  return `${(dayTargetMinutes(weekTargetMinutes, workdayCount) / 60).toFixed(1)}h`;
}

// Color bands based on how far off a target we are, and in which direction:
//   >50% deviation:
//     - short of target -> red ("over") -- the one real alarm signal.
//     - past target      -> amber ("under") -- surplus hours aren't a problem
//       the same way a shortfall is, so overshoot never escalates to red.
//   >25% deviation (either direction) -> amber ("under").
//   else -> green ("target").
// Note "under"/"over" here name severity tiers, not direction -- a week (or
// day) that's *over* target by 30% still gets the (amber) "under" tier,
// matching the original app's naming. Shared by the week summary and the
// per-day total so both use identical color rules.
export function classifySummaryState(actualMinutes: number, targetMinutes: number): SummaryState {
  const diff = actualMinutes - targetMinutes;
  const deviation = Math.abs(diff) / targetMinutes;
  if (deviation > 0.5) return diff < 0 ? "over" : "under";
  if (deviation > 0.25) return "under";
  return "target";
}

export function computeWeekSummary(totalMinutes: number, correctionMinutes: number, weekTargetMinutes: number): WeekSummary {
  const adjusted = totalMinutes + correctionMinutes;
  const diff = adjusted - weekTargetMinutes;
  const state = classifySummaryState(adjusted, weekTargetMinutes);
  const label = Math.abs(diff) < 3 && state === "target" ? "On Target" : `${formatDuration(Math.abs(diff))} ${diff < 0 ? "Under" : "Over"}`;

  return {
    adjustedMinutes: adjusted,
    state,
    label,
    fillPercent: Math.min((adjusted / meterMaxMinutes(weekTargetMinutes)) * 100, 100),
  };
}

export function targetMarkerPercent(weekTargetMinutes: number): number {
  return (weekTargetMinutes / meterMaxMinutes(weekTargetMinutes)) * 100;
}
