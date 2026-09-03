// Swiss Labour Act (Arbeitsgesetz, ArG) Art. 15: the longer a workday runs,
// the longer a break it requires --
//   > 5.5h worked -> at least 15 min break
//   > 7h worked   -> at least 30 min break
//   > 9h worked   -> at least 60 min break
// (Sunday/night work and the 11h daily rest period in Art. 15a are separate
// rules, not covered here.)

import type { NewWorkSession, WorkSession } from "../types/WorkSession";
import { timeStringToMinutes } from "./dateUtils";
import { ABS_DAY_END_MIN, minsToTimeStr, snapMinutesTo5, type MinuteInterval } from "./timelineLayout";

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

// What clicking the break tag (see TimelineTrack) needs to do to the day's
// other sessions to make room for the missing break, centered on the
// midpoint of the day's Working span (first Working start to last Working
// end).
//
// A free-slot search (à la drag-to-move) isn't enough here: compliance only
// counts a gap that sits *between* two Working sessions, so a break dropped
// into whatever empty space is nearest the midpoint -- e.g. tacked on after
// the last Working block, because the two blocks straddling the midpoint
// only had a few spare minutes between them -- would satisfy "doesn't
// overlap anything" while doing nothing for compliance.
//
// The break window is carved out of the schedule *in place* -- trimmed
// evenly from whatever sits on either side of the midpoint -- rather than
// inserted by pushing every later session further into the day. A day that
// ends at 16:00 still ends at 16:00 after adding its break; it just did
// less actual work to get there. Only the session(s) immediately touching
// the break window are ever touched: one trimmed shorter on its end (the
// one before), one trimmed shorter on its start (the one after) -- nothing
// elsewhere in the day moves.
export interface BreakInsertionPlan {
  breakSlot: MinuteInterval;
  // Existing sessions to trim in place (id preserved) -- order doesn't
  // matter to apply, since trimming a session can never make it newly
  // overlap another (its new edge lands exactly on the break window's edge,
  // which nothing untouched extends into).
  updates: WorkSession[];
  // A session that fully contains the break window has to split into two
  // (its trimmed self, kept under `updates`, plus this new tail piece) --
  // only ever set when exactly one session spans the whole cut.
  create: NewWorkSession | null;
}

export function planBreakInsertion(sessions: WorkSession[], deficitMinutes: number): BreakInsertionPlan | null {
  if (deficitMinutes <= 0) return null;

  const working = sessions
    .map((s) => ({ start: timeStringToMinutes(s.start), end: timeStringToMinutes(s.end), entryType: s.entryType }))
    .filter((s) => s.entryType === "Working")
    .sort((a, b) => a.start - b.start);
  if (working.length === 0) return null;

  const midpoint = (working[0].start + working[working.length - 1].end) / 2;

  // Gaps that already exist between two Working sessions are already
  // counted toward breakCompliance's breakMinutes. A naive window centered
  // purely on the midpoint can end up partially overlapping one of these --
  // which either double-counts already-free time as part of the "new"
  // break (undershooting the actual deficit once trimmed) or leaves a
  // second, separate sliver of free time dangling right next to the new
  // Lunch (reading as more added than the tag promised). So before
  // trimming anything, the window gets pushed flush against whichever edge
  // of an overlapping gap is nearer -- it always ends up carved entirely
  // out of real working time, sized to exactly `deficitMinutes`, matching
  // what the tag said was needed and nothing more.
  const existingGaps = working
    .slice(1)
    .map((w, i) => ({ start: working[i].end, end: w.start }))
    .filter((g) => g.end > g.start);

  let breakStart = midpoint - deficitMinutes / 2;
  let breakEnd = breakStart + deficitMinutes;
  for (const gap of existingGaps) {
    if (breakStart >= gap.end || gap.start >= breakEnd) continue; // no overlap
    const shiftToClearLeft = breakEnd - gap.start; // pull window back to end at gap.start
    const shiftToClearRight = gap.end - breakStart; // push window forward to start at gap.end
    if (shiftToClearLeft <= shiftToClearRight) {
      breakEnd = gap.start;
      breakStart = breakEnd - deficitMinutes;
    } else {
      breakStart = gap.end;
      breakEnd = breakStart + deficitMinutes;
    }
  }

  breakStart = snapMinutesTo5(breakStart);
  breakEnd = breakStart + deficitMinutes;
  if (breakStart < 0 || breakEnd > ABS_DAY_END_MIN) return null;
  // Snapping to the nearest 5 could have nudged the window right back into
  // a gap it was just pushed clear of -- bail rather than risk underCounting.
  if (existingGaps.some((gap) => breakStart < gap.end && gap.start < breakEnd)) return null;

  const updates: WorkSession[] = [];
  let create: NewWorkSession | null = null;

  for (const s of sessions) {
    const sStart = timeStringToMinutes(s.start);
    const sEnd = timeStringToMinutes(s.end);
    if (sEnd <= breakStart || sStart >= breakEnd) continue; // doesn't touch the break window

    if (sStart < breakStart && sEnd > breakEnd) {
      // Spans the whole break window -- split into a trimmed left piece
      // (this id) and a new right piece starting where the break ends.
      updates.push({ ...s, end: minsToTimeStr(breakStart) });
      create = {
        name: s.name,
        description: s.description,
        location: s.location,
        entryType: s.entryType,
        date: s.date,
        start: minsToTimeStr(breakEnd),
        end: s.end,
      };
    } else if (sStart < breakStart) {
      // Only reaches into the break from the left -- trim its end back.
      updates.push({ ...s, end: minsToTimeStr(breakStart) });
    } else if (sEnd > breakEnd) {
      // Only reaches into the break from the right -- delay its start;
      // its own end (and everything after it) is untouched.
      updates.push({ ...s, start: minsToTimeStr(breakEnd) });
    } else {
      // Sits entirely inside the break window -- shrinking around it would
      // delete a real entry outright, so bail instead of doing that
      // silently. Rare: only a session shorter than the deficit, sitting
      // right at the day's midpoint.
      return null;
    }
  }

  return { breakSlot: { start: breakStart, end: breakEnd }, updates, create };
}
