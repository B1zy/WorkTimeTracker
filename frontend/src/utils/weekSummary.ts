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
//   >majorThreshold deviation:
//     - short of target -> red ("over") -- the one real alarm signal.
//     - past target      -> amber ("under") -- surplus hours aren't a problem
//       the same way a shortfall is, so overshoot never escalates to red.
//   >minorThreshold deviation (either direction) -> amber ("under").
//   else -> green ("target").
// Note "under"/"over" here name severity tiers, not direction -- a week (or
// day) that's *over* target by 30% still gets the (amber) "under" tier,
// matching the original app's naming.
function classifyByDeviation(actualMinutes: number, targetMinutes: number, minorThreshold: number, majorThreshold: number): SummaryState {
  const diff = actualMinutes - targetMinutes;
  const deviation = Math.abs(diff) / targetMinutes;
  if (deviation > majorThreshold) return diff < 0 ? "over" : "under";
  if (deviation > minorThreshold) return "under";
  return "target";
}

// Shared by the week summary and the per-day total so both use identical,
// fairly forgiving color rules -- a single day or week is expected to swing
// some without it meaning anything.
export function classifySummaryState(actualMinutes: number, targetMinutes: number): SummaryState {
  return classifyByDeviation(actualMinutes, targetMinutes, 0.25, 0.5);
}

// Tighter bands for the by-weekday *average* (see OverviewView's
// "Average by weekday" chart): that average already smooths out day-to-day
// noise across a whole year, so a band loose enough for a single day's swing
// would make a real, consistent shortfall (e.g. Monday running ~20% under
// every week) read as indistinguishable from spot-on -- the one thing this
// chart exists to surface.
export function classifyWeekdayAverageState(actualMinutes: number, targetMinutes: number): SummaryState {
  return classifyByDeviation(actualMinutes, targetMinutes, 0.1, 0.3);
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
