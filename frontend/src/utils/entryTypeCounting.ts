// How each entry type contributes to worked-time totals.
//
// Domain aggregation, deliberately separate from timelineLayout.ts (which is
// layout maths and display-class maps) so the data hooks don't have to import
// a layout module.

import type { EntryType, WorkSession } from "../types/WorkSession";
import { durationMinutes } from "./dateUtils";

export type CountingMode = "count" | "ignore" | "subtract";

export type EntryTypeCounting = Record<EntryType, CountingMode>;

// `OvertimeCompensation` subtracts rather than counts, so that taking banked
// overtime off actually consumes the surplus it was banked against: carryover
// is sum(weekTotal - weekTarget) over prior weeks, so a compensation week has
// to land *under* target to cancel an earlier week that landed over it.
export const DEFAULT_ENTRY_TYPE_COUNTING: EntryTypeCounting = {
  Working: "count",
  Sick: "count",
  OvertimeCompensation: "subtract",
  Appointment: "count",
  Lunch: "ignore",
};

export const COUNTING_MODES: CountingMode[] = ["count", "ignore", "subtract"];

export const COUNTING_MODE_LABEL: Record<CountingMode, string> = {
  count: "Counts as worked",
  ignore: "Not counted",
  subtract: "Subtracts from worked",
};

export function entryTypeWeight(type: EntryType, counting: EntryTypeCounting): number {
  switch (counting[type]) {
    case "subtract":
      return -1;
    case "ignore":
      return 0;
    default:
      return 1;
  }
}

export function countedMinutes(
  session: Pick<WorkSession, "start" | "end" | "entryType">,
  counting: EntryTypeCounting
): number {
  return durationMinutes(session.start, session.end) * entryTypeWeight(session.entryType, counting);
}

// The single shared rule -- every place that totals worked time routes through
// this so the three call sites can't drift apart.
export function sumCountedMinutes(
  sessions: Pick<WorkSession, "start" | "end" | "entryType">[],
  counting: EntryTypeCounting
): number {
  return sessions.reduce((sum, session) => sum + countedMinutes(session, counting), 0);
}

export function sanitizeCounting(raw: unknown): EntryTypeCounting {
  const result = { ...DEFAULT_ENTRY_TYPE_COUNTING };
  if (!raw || typeof raw !== "object") return result;

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key in result && typeof value === "string" && COUNTING_MODES.includes(value as CountingMode)) {
      result[key as EntryType] = value as CountingMode;
    }
  }
  return result;
}
