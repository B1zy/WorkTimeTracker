// Persisted, user-customizable app settings (colors, weekly target, timebar
// range). Kept entirely client-side (localStorage) -- the backend doesn't
// need to know about presentation preferences.

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

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      weeklyTargetMinutes: parsed.weeklyTargetMinutes ?? DEFAULT_WEEKLY_TARGET_MINUTES,
      colors: { ...DEFAULT_COLORS, ...parsed.colors },
      timelineStartMin: parsed.timelineStartMin ?? DEFAULT_TIMELINE_START_MIN,
      timelineEndMin: parsed.timelineEndMin ?? DEFAULT_TIMELINE_END_MIN,
    };
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
