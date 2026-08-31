// JSON backup format for the whole app: sessions from the backend plus the
// client-side settings and per-week corrections, which otherwise live only in
// localStorage and would be lost with browser data.

import type { NewWorkSession, WorkSession } from "../types/WorkSession";
import { sanitizeSettings, type AppSettings } from "./settings";
import { sanitizeCorrections, type CorrectionsByWeek } from "./corrections";

export const BACKUP_FORMAT = "worktimetracker-backup";
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: string;
  version: number;
  exportedAt: string;
  /** Ids are stripped -- the server assigns fresh ones on restore. */
  sessions: NewWorkSession[];
  settings: AppSettings;
  corrections: CorrectionsByWeek;
}

export function buildBackup(
  sessions: WorkSession[],
  settings: AppSettings,
  corrections: CorrectionsByWeek
): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    sessions: sessions.map(({ id: _id, ...rest }) => rest),
    settings,
    corrections,
  };
}

function isSessionShaped(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.name === "string" &&
    typeof s.date === "string" &&
    typeof s.start === "string" &&
    typeof s.end === "string"
  );
}

// Throws an Error with a readable message rather than letting a stack trace
// reach the user -- this parses a file they picked off disk.
export function parseBackup(text: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("That file isn't a WorkTimeTracker backup.");
  }

  const candidate = parsed as Partial<BackupFile>;
  if (candidate.format !== BACKUP_FORMAT) {
    throw new Error("That file isn't a WorkTimeTracker backup.");
  }
  if (typeof candidate.version !== "number" || candidate.version > BACKUP_VERSION) {
    throw new Error(`This backup was made by a newer version (v${String(candidate.version)}) and can't be read.`);
  }
  if (!Array.isArray(candidate.sessions) || !candidate.sessions.every(isSessionShaped)) {
    throw new Error("This backup's session data is missing or malformed.");
  }

  // settings/corrections come from a file the user picked off disk, not from
  // our own localStorage write path -- run them through the same sanitizers
  // loadSettings()/loadCorrections() use rather than trusting the shape.
  // Only sanitize when the field is actually present, so a legacy/partial
  // backup missing one still leaves the caller's own "is it there?" check
  // (and thus the current in-app value) alone rather than forcing defaults.
  return {
    ...candidate,
    sessions: candidate.sessions,
    settings: candidate.settings === undefined ? undefined : sanitizeSettings(candidate.settings),
    corrections: candidate.corrections === undefined ? undefined : sanitizeCorrections(candidate.corrections),
  } as BackupFile;
}

export function backupFilename(prefix = "worktimetracker-backup"): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `${prefix}-${stamp}.json`;
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
