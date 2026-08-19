import { useRef, useState, type ChangeEvent } from "react";
import { useSettings } from "../contexts/SettingsContext";
import {
  COUNTING_MODES,
  COUNTING_MODE_LABEL,
  type CountingMode,
} from "../utils/entryTypeCounting";
import { WEEKDAY_DISPLAY_ORDER, WEEKDAY_LABEL, type Weekday } from "../utils/workweek";
import { ENTRY_TYPE_LABEL } from "../utils/timelineLayout";
import { timeStringToMinutes } from "../utils/dateUtils";
import type { EntryType } from "../types/WorkSession";

const ENTRY_TYPES: EntryType[] = ["Working", "Sick", "OvertimeCompensation", "Appointment", "Lunch"];

// Shortened only for this settings list, where a fixed label column leaves no
// room for the full name to avoid wrapping -- everywhere else (timeline
// titles, aria-labels) still uses the full ENTRY_TYPE_LABEL.
const SETTINGS_ENTRY_TYPE_LABEL: Partial<Record<EntryType, string>> = {
  OvertimeCompensation: "Overtime comp.",
};

const DAY_MINUTES = 24 * 60;

// <input type="time"> can't represent "24:00" (valid range is 00:00-23:59),
// so the display clamps to 23:59 for that one boundary value. The stored
// minutes are untouched -- this only affects what the picker shows until the
// user actually changes it.
function minutesToTimeInputValue(mins: number): string {
  const clamped = Math.min(Math.max(Math.round(mins), 0), DAY_MINUTES - 1);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface SettingsPanelProps {
  onClearAllData: () => Promise<void>;
  onExportData: () => Promise<void>;
  onImportData: (
    file: File,
    onProgress?: (done: number, total: number) => void
  ) => Promise<{ imported: number; failed: number }>;
}

// Rendered inline at the bottom of the Overview tab (not a modal): the whole
// point of moving it here was to have the chart and the settings that shape
// it on one scrollable page instead of a popup you can't see the data behind.
export function SettingsPanel({ onClearAllData, onExportData, onImportData }: SettingsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { settings, updateSettings } = useSettings();
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  function handleTargetHoursChange(event: ChangeEvent<HTMLInputElement>) {
    const hours = Number(event.target.value);
    if (!Number.isFinite(hours) || hours <= 0) return;
    updateSettings((prev) => ({ ...prev, weeklyTargetMinutes: Math.round(hours * 60) }));
  }

  function handleTimelineStartChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    if (!value) return;
    const mins = timeStringToMinutes(value);
    updateSettings((prev) => ({ ...prev, timelineStartMin: Math.min(mins, prev.timelineEndMin - 60) }));
  }

  function handleTimelineEndChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    if (!value) return;
    const mins = timeStringToMinutes(value);
    updateSettings((prev) => ({ ...prev, timelineEndMin: Math.max(mins, prev.timelineStartMin + 60) }));
  }

  async function handleExport() {
    setBusy(true);
    setStatus(null);
    try {
      await onExportData();
      setStatus("Backup downloaded.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset immediately so picking the same file twice still fires onChange.
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setStatus("Saving a copy of your current data first…");
    try {
      const { imported, failed } = await onImportData(file, (done, total) => {
        setStatus(`Restoring ${done} of ${total}…`);
      });
      setStatus(failed > 0 ? `Restored ${imported} entries, ${failed} failed.` : `Restored ${imported} entries.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function handleCountingChange(type: EntryType, mode: CountingMode) {
    updateSettings((prev) => ({
      ...prev,
      entryTypeCounting: { ...prev.entryTypeCounting, [type]: mode },
    }));
  }

  function handleWorkdayToggle(day: Weekday, enabled: boolean) {
    updateSettings((prev) => {
      const next = enabled ? [...prev.workdays, day] : prev.workdays.filter((d) => d !== day);
      // Never allow an empty work week -- the daily target divides by this count.
      if (next.length === 0) return prev;
      return { ...prev, workdays: WEEKDAY_DISPLAY_ORDER.filter((d) => next.includes(d)) };
    });
  }

  async function handleClearAllData() {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    setClearing(true);
    try {
      await onClearAllData();
    } finally {
      setClearing(false);
      setConfirmingClear(false);
    }
  }

  return (
    <section className="settings-inline">
      <h2 id="settings-title">Settings</h2>

      <div className="settings-grid">
      <section className="settings-section">
        <h3 className="settings-section-title">Weekly target</h3>
        <div className="form-row">
          <label htmlFor="weekly-target-input">Target</label>
          <div className="settings-input-with-unit">
            <input
              id="weekly-target-input"
              type="number"
              min={1}
              step={0.5}
              value={settings.weeklyTargetMinutes / 60}
              onChange={handleTargetHoursChange}
            />
            <span className="settings-input-unit">hours / week</span>
          </div>
        </div>
        <div className="form-row">
          <label>Work days</label>
          <div className="settings-weekday-row" role="group" aria-label="Work days">
            {WEEKDAY_DISPLAY_ORDER.map((day) => {
              const checked = settings.workdays.includes(day);
              const isLastRemaining = checked && settings.workdays.length === 1;
              return (
                <button
                  key={day}
                  type="button"
                  className={`settings-weekday${checked ? " is-on" : ""}`}
                  aria-pressed={checked}
                  disabled={isLastRemaining}
                  title={isLastRemaining ? "At least one work day is required" : undefined}
                  onClick={() => handleWorkdayToggle(day, !checked)}
                >
                  {WEEKDAY_LABEL[day]}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">What counts as worked time</h3>
        <div className="settings-counting-grid">
          {ENTRY_TYPES.map((type) => (
            <div key={type} className="settings-counting-row">
              <label htmlFor={`counting-${type}`} className="settings-counting-label">
                {SETTINGS_ENTRY_TYPE_LABEL[type] ?? ENTRY_TYPE_LABEL[type]}
              </label>
              <select
                id={`counting-${type}`}
                className="settings-counting-select"
                value={settings.entryTypeCounting[type]}
                disabled={type === "Working"}
                onChange={(e) => handleCountingChange(type, e.target.value as CountingMode)}
              >
                {COUNTING_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {COUNTING_MODE_LABEL[mode]}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      {/* Timebar range + Data & backup stacked in one grid column, rather
          than each taking its own -- together they're still shorter than
          the "What counts" card, which stacking two separate narrow columns
          side by side wasn't guaranteed to be. */}
      <div className="settings-stack">
      <section className="settings-section">
        <h3 className="settings-section-title">Timebar range</h3>
        <div className="settings-time-range-row">
          <input
            id="timeline-start-input"
            type="time"
            lang="en-GB"
            value={minutesToTimeInputValue(settings.timelineStartMin)}
            onChange={handleTimelineStartChange}
            aria-label="Starts at"
          />
          <span className="settings-time-range-to">to</span>
          <input
            id="timeline-end-input"
            type="time"
            lang="en-GB"
            value={minutesToTimeInputValue(settings.timelineEndMin)}
            onChange={handleTimelineEndChange}
            aria-label="Ends at"
          />
        </div>
        <div className="settings-time-range-preview">
          <div className="settings-time-range-track">
            <div
              className="settings-time-range-fill"
              style={{
                left: `${(settings.timelineStartMin / DAY_MINUTES) * 100}%`,
                width: `${((settings.timelineEndMin - settings.timelineStartMin) / DAY_MINUTES) * 100}%`,
              }}
            />
          </div>
          <div className="settings-time-range-ticks">
            <span>00:00</span>
            <span>12:00</span>
            <span>24:00</span>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">Data &amp; backup</h3>
        <div className="settings-backup-actions">
          <button type="button" className="btn-secondary" onClick={handleExport} disabled={busy}>
            Export backup
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            Restore…
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleFileChosen}
        />
        {status && <p className="settings-hint settings-backup-status">{status}</p>}
        <hr className="settings-divider" />
        <button
          type="button"
          className={`btn-delete settings-clear-btn${confirmingClear ? " is-confirming" : ""}`}
          onClick={handleClearAllData}
          disabled={clearing}
        >
          {confirmingClear ? "Really delete everything? Click again to confirm" : "Clear all data"}
        </button>
        {confirmingClear && (
          <button type="button" className="btn-secondary settings-clear-cancel" onClick={() => setConfirmingClear(false)}>
            Cancel
          </button>
        )}
      </section>
      </div>
      </div>
    </section>
  );
}
