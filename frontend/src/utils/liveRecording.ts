// Persists an in-progress "clock in" timestamp across reloads -- started via
// the status-indicator button (see useLiveRecording), so a page refresh (or
// closing and reopening the tab) mid-recording doesn't silently lose it.
// Device-specific like weatherLocation, so kept out of AppSettings/backup.

const STORAGE_KEY = "worktimetracker.liveRecording.v1";

export function loadRecordingStart(): Date | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export function saveRecordingStart(date: Date | null): void {
  if (date) {
    localStorage.setItem(STORAGE_KEY, date.toISOString());
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}
