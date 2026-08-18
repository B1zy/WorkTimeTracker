import { addDays, getMonday } from "./dateUtils";

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

// Always 6 Monday-start weeks (42 days) so the grid height never jumps
// between months, matching the leading/trailing-day style of a native
// calendar picker.
export function buildMonthGrid(monthAnchor: Date): Date[] {
  const gridStart = getMonday(startOfMonth(monthAnchor));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function isSameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Every Monday-start work week whose Monday falls within `year`, oldest first
// -- so the Overview contribution chart always reads left-to-right as January
// through December, rather than a trailing window that wraps mid-year.
//
// `offsets` are Monday-relative day offsets (see workweek.workdayOffsets), so
// each week contributes one cell per active work day.
export function buildCalendarYearWeeks(year: number, offsets: number[]): Date[][] {
  const firstMonday = getMonday(new Date(year, 0, 1));
  const lastMonday = getMonday(new Date(year, 11, 31));
  const weekCount = Math.round((lastMonday.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return Array.from({ length: weekCount }, (_, w) => {
    const monday = addDays(firstMonday, w * 7);
    return offsets.map((offset) => addDays(monday, offset));
  });
}
