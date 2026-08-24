// Swiss Labour Act (Arbeitsgesetz, ArG) Art. 15: the longer a workday runs,
// the longer a break it requires --
//   > 5.5h worked -> at least 15 min break
//   > 7h worked   -> at least 30 min break
//   > 9h worked   -> at least 60 min break
// (Sunday/night work and the 11h daily rest period in Art. 15a are separate
// rules, not covered here.)

import type { WorkSession } from "../types/WorkSession";
import { timeStringToMinutes } from "./dateUtils";

export interface BreakCompliance {
  workedMinutes: number;
  breakMinutes: number;
  requiredMinutes: number;
  isCompliant: boolean;
}

export function requiredBreakMinutes(workedMinutes: number): number {
  if (workedMinutes > 9 * 60) return 60;
  if (workedMinutes > 7 * 60) return 30;
  if (workedMinutes > 5.5 * 60) return 15;
  return 0;
}

// Only "Working" sessions count toward the worked-hours threshold and toward
// the workday's span. Break time is whatever, inside that span, isn't itself
// a Working session -- an explicit Lunch entry and a plain unlogged gap
// between two Working blocks both count the same way, since either means the
// employee wasn't working during that time.
export function computeDayBreakCompliance(
  sessions: Pick<WorkSession, "entryType" | "start" | "end">[]
): BreakCompliance {
  const working = sessions
    .filter((s) => s.entryType === "Working")
    .map((s) => ({ start: timeStringToMinutes(s.start), end: timeStringToMinutes(s.end) }))
    .sort((a, b) => a.start - b.start);

  const workedMinutes = working.reduce((sum, s) => sum + (s.end - s.start), 0);

  let breakMinutes = 0;
  for (let i = 1; i < working.length; i++) {
    const gap = working[i].start - working[i - 1].end;
    if (gap > 0) breakMinutes += gap;
  }

  const required = requiredBreakMinutes(workedMinutes);
  return {
    workedMinutes,
    breakMinutes,
    requiredMinutes: required,
    isCompliant: breakMinutes >= required,
  };
}
