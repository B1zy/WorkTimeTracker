// Date/time helpers shared across the app.
// "ISO date" here always means "YYYY-MM-DD", matching what the backend expects.

export function getMonday(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  // Sunday has to roll back 6 days to reach Monday; any other day rolls back (day - 1).
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Formats a Date using its LOCAL date parts.
// (Date#toISOString() converts to UTC first, which can shift the calendar
// day depending on timezone -- not what we want for a date-only value.)
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatWeekRangeLabel(monday: Date, friday: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const start = monday.toLocaleDateString(undefined, opts);
  const end = friday.toLocaleDateString(undefined, { ...opts, year: "numeric" });
  return `${start} – ${end}`;
}

export function formatDayHeaderLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function formatWeekdayShort(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
}

export function formatDayShort(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// "09:30:00" -> 570 (minutes since midnight)
export function timeStringToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

export function durationMinutes(start: string, end: string): number {
  return timeStringToMinutes(end) - timeStringToMinutes(start);
}

// True if [aStart, aEnd) and [bStart, bEnd) share any minutes.
export function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const aS = timeStringToMinutes(aStart);
  const aE = timeStringToMinutes(aEnd);
  const bS = timeStringToMinutes(bStart);
  const bE = timeStringToMinutes(bEnd);
  return aS < bE && bS < aE;
}

// Minutes -> "6h 42m". Drops whichever unit is zero so exact hours read as
// "6h" instead of "6h 0m", and sub-hour durations read as "42m" alone.
export function formatDuration(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? "-" : "";
  const abs = Math.round(Math.abs(totalMinutes));
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;

  if (hours === 0) return `${sign}${minutes}m`;
  if (minutes === 0) return `${sign}${hours}h`;
  return `${sign}${hours}h ${minutes}m`;
}

// Minutes -> "+6h 42m" / "-6h 42m" / "0m" -- for values that are inherently a
// balance (ahead/behind) rather than a plain duration, where the sign itself
// is the information.
export function formatSignedDuration(minutes: number): string {
  const sign = minutes > 0 ? "+" : minutes < 0 ? "-" : "";
  return `${sign}${formatDuration(Math.abs(minutes))}`;
}

// "09:30:00" -> "9:30"
export function formatTimeShort(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":");
  return `${Number(hours)}:${minutes}`;
}
