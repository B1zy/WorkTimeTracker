import { formatDuration } from "./dateUtils";

export type SummaryState = "under" | "target" | "over";

export interface WeekSummary {
  adjustedMinutes: number;
  requiredMinutes: number;
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
  return formatDuration(dayTargetMinutes(weekTargetMinutes, workdayCount));
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
  // A target of zero or less (e.g. a week whose required minutes already
  // dropped to/below zero because banked carryover covers it entirely) has
  // nothing to measure a percentage deviation against -- any real total
  // already clears it, so it reads as flat "target" rather than dividing by
  // zero/a negative number.
  if (targetMinutes <= 0) return "target";
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

// Tighter bands for the yearly heatmap's day cells (see OverviewView's
// dayCellClass), and deliberately direction-sensitive rather than
// deviation-magnitude-only: falling short of a day's target is the thing
// worth flagging with urgency, while running over it is never a problem (a
// surplus just banks as carryover) -- so any day at or past its target
// reads green no matter how far past, a shortfall of 5-20% reads amber, and
// a shortfall beyond 20% reads red. "under"/"over" below name severity
// tiers, not direction -- see classifyByDeviation's note above.
export function classifyDayCellState(actualMinutes: number, targetMinutes: number): SummaryState {
  if (targetMinutes <= 0) return "target";
  const deviation = (actualMinutes - targetMinutes) / targetMinutes;
  if (deviation >= -0.05) return "target";
  if (deviation >= -0.2) return "under";
  return "over";
}

// `carryoverMinutes` is the running flex-time balance banked in from every
// prior week (positive = worked ahead, negative = fell behind) -- see
// entryTypeCounting.ts. `requiredMinutes` (target minus that balance) is what
// this week actually needed to hit, banked time included -- the label/state
// are judged against *that*, not the plain target, so a week that's short of
// its raw target but covered by carryover reads as on-target/over rather
// than under. (An earlier version judged the label against the plain target
// only, deliberately excluding carryover -- reversed on request: the whole
// point of banking flex time is that it should visibly cover a lighter week.)
export function computeWeekSummary(
  totalMinutes: number,
  correctionMinutes: number,
  carryoverMinutes: number,
  weekTargetMinutes: number
): WeekSummary {
  const adjusted = totalMinutes + correctionMinutes;
  const required = weekTargetMinutes - carryoverMinutes;
  const diff = adjusted - required;
  const state = classifySummaryState(adjusted, required);
  const label = Math.abs(diff) < 3 && state === "target" ? "On Target" : `${formatDuration(Math.abs(diff))} ${diff < 0 ? "Under" : "Over"}`;

  return {
    adjustedMinutes: adjusted,
    requiredMinutes: required,
    state,
    label,
    fillPercent: Math.min((adjusted / meterMaxMinutes(weekTargetMinutes)) * 100, 100),
  };
}

// Scales a minute value against the meter's fixed, nominal-target-based
// range, clamped so nothing can push a marker off either end of the track.
function meterPercent(minutes: number, weekTargetMinutes: number): number {
  const percent = (minutes / meterMaxMinutes(weekTargetMinutes)) * 100;
  return Math.min(Math.max(percent, 0), 100);
}

// The needle's position -- always the plain "42h" mark. It doesn't move for
// carryover (see SummaryGauge's credit/debt segment for how that's shown
// instead): a fixed goalpost is what makes "the bar reaches the goalpost"
// mean the same thing every week.
export function nominalTargetPercent(weekTargetMinutes: number): number {
  return meterPercent(weekTargetMinutes, weekTargetMinutes);
}

// Magnitude of the banked carryover, in the same percent-of-meter units as
// fillPercent/nominalTargetPercent, so SummaryGauge can lay the credit/debt
// segment out purely in percentages without knowing about minutes at all.
export function carryoverPercent(carryoverMinutes: number, weekTargetMinutes: number): number {
  return meterPercent(Math.abs(carryoverMinutes), weekTargetMinutes);
}
