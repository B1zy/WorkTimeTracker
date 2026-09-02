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
}

export const DEFAULT_COLORS: SettingsColors = {
  locRemote: "#D9A441",
  locInoffice: "#FF7A33",
  locOther: "#D8CDB8",
  typeSick: "#C1443C",
  typeOvertimeCompensation: "#8C6A2F",
  typeAppointment: "#B5654F",
  typeLunch: "#C9B38C",
};

export const DEFAULT_WEEKLY_TARGET_MINUTES = 42 * 60;
export const DEFAULT_TIMELINE_START_MIN = 0;
export const DEFAULT_TIMELINE_END_MIN = 24 * 60;

export const DEFAULT_SETTINGS: AppSettings = {
  weeklyTargetMinutes: DEFAULT_WEEKLY_TARGET_MINUTES,
  colors: DEFAULT_COLORS,
  timelineStartMin: DEFAULT_TIMELINE_START_MIN,
  timelineEndMin: DEFAULT_TIMELINE_END_MIN,
  entryTypeCounting: DEFAULT_ENTRY_TYPE_COUNTING,
  workdays: DEFAULT_WORKDAYS,
  animationsEnabled: true,
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
};

export const LOCATION_COLOR_KEYS: (keyof SettingsColors)[] = ["locRemote", "locInoffice", "locOther"];
export const ENTRY_TYPE_COLOR_KEYS: (keyof SettingsColors)[] = [
  "typeSick",
  "typeOvertimeCompensation",
  "typeAppointment",
  "typeLunch",
];

export const COLOR_LABEL: Record<keyof SettingsColors, string> = {
  locRemote: "Remote",
  locInoffice: "In Office",
  locOther: "Other",
  typeSick: "Sick",
  typeOvertimeCompensation: "Overtime Compensation",
  typeAppointment: "Appointment",
  typeLunch: "Lunch",
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
  };
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
