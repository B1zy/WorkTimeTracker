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
