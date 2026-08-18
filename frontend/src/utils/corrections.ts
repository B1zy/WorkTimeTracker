// Per-week manual time corrections, keyed by the week's Monday (ISO date).
//
// Deliberately kept in its own localStorage key rather than folded into
// AppSettings: these are user *data*, not presentation preferences. They must
// survive a "reset settings to defaults", and they belong in the backup file.

export type CorrectionsByWeek = Record<string, number>;

const STORAGE_KEY = "worktimetracker.corrections.v1";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Drops anything that isn't an ISO-date key mapping to a finite number, so a
// hand-edited or corrupted payload can't inject NaN into the week summary.
export function sanitizeCorrections(raw: unknown): CorrectionsByWeek {
  if (!raw || typeof raw !== "object") return {};

  const result: CorrectionsByWeek = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (ISO_DATE.test(key) && typeof value === "number" && Number.isFinite(value)) {
      result[key] = value;
    }
  }
  return result;
}

export function loadCorrections(): CorrectionsByWeek {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return sanitizeCorrections(JSON.parse(raw));
  } catch {
    return {};
  }
}

// Zero entries are dropped before writing: navigating through a year of weeks
// would otherwise accumulate a `"2026-03-02": 0` for every week visited.
export function saveCorrections(corrections: CorrectionsByWeek): void {
  const nonZero: CorrectionsByWeek = {};
  for (const [key, value] of Object.entries(corrections)) {
    if (value !== 0) nonZero[key] = value;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nonZero));
}
