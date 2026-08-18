// Which weekdays make up the tracked work week.
//
// The week always *starts* on Monday (getMonday and all week navigation assume
// it); these settings only select which of the seven Monday-relative slots are
// shown on the week view and counted toward totals.

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // JS Date#getDay(), 0 = Sunday

export const DEFAULT_WORKDAYS: Weekday[] = [1, 2, 3, 4, 5];

/** Monday-first display order, for rendering the settings checkboxes. */
export const WEEKDAY_DISPLAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  0: "Sun",
};

/** Weekday numbers -> Monday-relative day offsets (0..6), deduped, ascending. */
export function workdayOffsets(workdays: Weekday[]): number[] {
  const offsets = new Set(workdays.map((d) => (d + 6) % 7));
  return [...offsets].sort((a, b) => a - b);
}

export function weekDates(monday: Date, workdays: Weekday[]): Date[] {
  return workdayOffsets(workdays).map((offset) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + offset);
    return date;
  });
}

export function workdayCount(workdays: Weekday[]): number {
  return workdayOffsets(workdays).length;
}

// Must never return an empty array: the daily target divides the weekly target
// by this count, and zero would yield Infinity.
export function sanitizeWorkdays(raw: unknown): Weekday[] {
  if (!Array.isArray(raw)) return DEFAULT_WORKDAYS;

  const valid = new Set<Weekday>();
  for (const value of raw) {
    if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6) {
      valid.add(value as Weekday);
    }
  }

  if (valid.size === 0) return DEFAULT_WORKDAYS;
  return WEEKDAY_DISPLAY_ORDER.filter((d) => valid.has(d));
}
