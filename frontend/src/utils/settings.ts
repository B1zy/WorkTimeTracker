// Persisted, user-customizable app settings (colors, weekly target, timebar
// range). Kept entirely client-side (localStorage) -- the backend doesn't
// need to know about presentation preferences.
//
// NOTE: loadSettings() below enumerates every field explicitly rather than
// spreading `parsed`. Any field added to AppSettings MUST get a line there too,
// or it reads as undefined at runtime for anyone with an existing stored blob.

import { DEFAULT_ENTRY_TYPE_COUNTING, sanitizeCounting, type EntryTypeCounting } from "./entryTypeCounting";
import { DEFAULT_WORKDAYS, sanitizeWorkdays, type Weekday } from "./workweek";

export interface SettingsColors {
  locRemote: string;
  locInoffice: string;
  locOther: string;
  typeSick: string;
  typeOvertimeCompensation: string;
  typeAppointment: string;
  typeLunch: string;
  typeVacation: string;
}

export interface AppSettings {
  weeklyTargetMinutes: number;
  colors: SettingsColors;
  // Minutes-since-midnight bounds for what the day timebars display/allow
  // dragging within. Defaults to the full day (0 - 1440).
  timelineStartMin: number;
  timelineEndMin: number;
  // How each entry type contributes to worked-time totals.
  entryTypeCounting: EntryTypeCounting;
  // Which weekdays are shown on the week view and counted toward totals.
  workdays: Weekday[];
  // Card entrances, popovers, hover/press transitions, etc. Independent of
  // (and additive with) the OS-level prefers-reduced-motion media query --
  // either one turns animations off, since a user might want them off here
  // without changing a system-wide accessibility setting.
  animationsEnabled: boolean;
  // Light/dark UI palette. Independent of the OS `prefers-color-scheme`
  // media query -- this is an explicit user choice, not a system follow.
  theme: "dark" | "light";
  // Total vacation days allotted for the year -- the denominator for the
  // "vacation days used" stat (see OverviewView); a Vacation entry's own
  // duration relative to that day's target is what counts as "used", so a
  // half-day entry counts as half a day rather than a whole one.
  vacationDaysPerYear: number;
  // Dates (ISO "YYYY-MM-DD") the user has marked as a public holiday. An
  // empty day that falls on one of these doesn't count as a missed-target
  // deficit in the carryover balance (see useCarryoverMinutes) -- there was
  // nothing to log, not a shortfall.
  holidays: string[];
}

export const DEFAULT_COLORS: SettingsColors = {
  locRemote: "#D9A441",
  locInoffice: "#FF7A33",
  locOther: "#D8CDB8",
  typeSick: "#C1443C",
  typeOvertimeCompensation: "#8C6A2F",
  typeAppointment: "#B5654F",
  typeLunch: "#C9B38C",
  typeVacation: "#C9A227",
};

export const DEFAULT_WEEKLY_TARGET_MINUTES = 42 * 60;
export const DEFAULT_TIMELINE_START_MIN = 0;
export const DEFAULT_TIMELINE_END_MIN = 24 * 60;
export const DEFAULT_VACATION_DAYS_PER_YEAR = 25;

export const DEFAULT_SETTINGS: AppSettings = {
  weeklyTargetMinutes: DEFAULT_WEEKLY_TARGET_MINUTES,
  colors: DEFAULT_COLORS,
  timelineStartMin: DEFAULT_TIMELINE_START_MIN,
  timelineEndMin: DEFAULT_TIMELINE_END_MIN,
  entryTypeCounting: DEFAULT_ENTRY_TYPE_COUNTING,
  workdays: DEFAULT_WORKDAYS,
  animationsEnabled: true,
  theme: "dark",
  vacationDaysPerYear: DEFAULT_VACATION_DAYS_PER_YEAR,
  holidays: [],
};

const STORAGE_KEY = "worktimetracker.settings.v1";

export const COLOR_CSS_VAR: Record<keyof SettingsColors, string> = {
  locRemote: "--loc-remote",
  locInoffice: "--loc-inoffice",
  locOther: "--loc-other",
  typeSick: "--type-sick",
  typeOvertimeCompensation: "--type-overtime-compensation",
  typeAppointment: "--type-appointment",
  typeLunch: "--type-lunch",
  typeVacation: "--type-vacation",
};

export const LOCATION_COLOR_KEYS: (keyof SettingsColors)[] = ["locRemote", "locInoffice", "locOther"];
export const ENTRY_TYPE_COLOR_KEYS: (keyof SettingsColors)[] = [
  "typeSick",
  "typeOvertimeCompensation",
  "typeAppointment",
  "typeLunch",
  "typeVacation",
];

export const COLOR_LABEL: Record<keyof SettingsColors, string> = {
  locRemote: "Remote",
  locInoffice: "In Office",
  locOther: "Other",
  typeSick: "Sick",
  typeOvertimeCompensation: "Overtime Compensation",
  typeAppointment: "Appointment",
  typeLunch: "Lunch",
  typeVacation: "Vacation",
};

// Rebuilds a settings object field-by-field from an untrusted source (a
// localStorage blob or an imported backup file), falling back to defaults
// for anything missing or the wrong type. Never trusts the shape wholesale --
// see the NOTE at the top of this file.
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function sanitizeSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  const parsed = raw as Partial<AppSettings>;

  return {
    weeklyTargetMinutes: isFiniteNumber(parsed.weeklyTargetMinutes)
      ? parsed.weeklyTargetMinutes
      : DEFAULT_WEEKLY_TARGET_MINUTES,
    colors: sanitizeColors(parsed.colors),
    timelineStartMin: isFiniteNumber(parsed.timelineStartMin) ? parsed.timelineStartMin : DEFAULT_TIMELINE_START_MIN,
    timelineEndMin: isFiniteNumber(parsed.timelineEndMin) ? parsed.timelineEndMin : DEFAULT_TIMELINE_END_MIN,
    entryTypeCounting: sanitizeCounting(parsed.entryTypeCounting),
    workdays: sanitizeWorkdays(parsed.workdays),
    animationsEnabled: typeof parsed.animationsEnabled === "boolean" ? parsed.animationsEnabled : true,
    theme: parsed.theme === "light" ? "light" : "dark",
    vacationDaysPerYear:
      isFiniteNumber(parsed.vacationDaysPerYear) && parsed.vacationDaysPerYear >= 0
        ? parsed.vacationDaysPerYear
        : DEFAULT_VACATION_DAYS_PER_YEAR,
    holidays: sanitizeHolidays(parsed.holidays),
  };
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeHolidays(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set<string>();
  for (const value of raw) {
    if (typeof value === "string" && ISO_DATE_PATTERN.test(value)) unique.add(value);
  }
  return [...unique].sort();
}

function sanitizeColors(raw: unknown): SettingsColors {
  const result = { ...DEFAULT_COLORS };
  if (!raw || typeof raw !== "object") return result;

  for (const key of Object.keys(result) as (keyof SettingsColors)[]) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "string") result[key] = value;
  }
  return result;
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function applyColorOverrides(colors: SettingsColors): void {
  const root = document.documentElement;
  for (const key of Object.keys(COLOR_CSS_VAR) as (keyof SettingsColors)[]) {
    root.style.setProperty(COLOR_CSS_VAR[key], colors[key]);
  }
}

// Toggles the blanket animation/transition kill-switch (see index.css's
// .no-animations rule) that backs this setting -- a plain class rather than
// a CSS var since it needs to override every animated selector at once, not
// just feed a value into ones that opted in.
export function applyMotionPreference(animationsEnabled: boolean): void {
  document.documentElement.classList.toggle("no-animations", !animationsEnabled);
}

// A `data-theme` attribute (see index.css's `[data-theme="light"]` palette
// override) rather than a class, matching the convention most CSS theming
// examples/tools expect -- and unlike a class, its *absence* has no meaning
// to guard against, since "dark" is simply never written as an attribute.
export function applyTheme(theme: AppSettings["theme"]): void {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}
