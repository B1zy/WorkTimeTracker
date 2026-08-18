import { useRef, useState, type ChangeEvent } from "react";
import { useSettings } from "../contexts/SettingsContext";
import {
  COUNTING_MODES,
  COUNTING_MODE_LABEL,
  type CountingMode,
} from "../utils/entryTypeCounting";
import { WEEKDAY_DISPLAY_ORDER, WEEKDAY_LABEL, workdayCount, type Weekday } from "../utils/workweek";
import { ENTRY_TYPE_LABEL } from "../utils/timelineLayout";
import { dayTargetLabel } from "../utils/weekSummary";
import type { EntryType } from "../types/WorkSession";

const ENTRY_TYPES: EntryType[] = ["Working", "Sick", "OvertimeCompensation", "Appointment", "Lunch"];

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
    const hours = Number(event.target.value);
    if (!Number.isFinite(hours) || hours < 0) return;
    const mins = Math.round(hours * 60);
    updateSettings((prev) => ({ ...prev, timelineStartMin: Math.min(mins, prev.timelineEndMin - 60) }));
  }

  function handleTimelineEndChange(event: ChangeEvent<HTMLInputElement>) {
    const hours = Number(event.target.value);
    if (!Number.isFinite(hours) || hours <= 0) return;
    const mins = Math.round(hours * 60);
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
          <label htmlFor="weekly-target-input">Target hours per week</label>
          <input
            id="weekly-target-input"
            type="number"
            min={1}
            step={0.5}
            value={settings.weeklyTargetMinutes / 60}
            onChange={handleTargetHoursChange}
          />
        </div>
        <div className="form-row">
          <label>Work days</label>
          <div className="settings-weekday-row">
            {WEEKDAY_DISPLAY_ORDER.map((day) => {
              const checked = settings.workdays.includes(day);
              const isLastRemaining = checked && settings.workdays.length === 1;
              return (
                <label
                  key={day}
                  className={`settings-weekday${checked ? " is-on" : ""}`}
                  title={isLastRemaining ? "At least one work day is required" : undefined}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isLastRemaining}
                    onChange={(e) => handleWorkdayToggle(day, e.target.checked)}
                  />
                  <span>{WEEKDAY_LABEL[day]}</span>
                </label>
              );
            })}
          </div>
        </div>
        <p className="settings-hint">
          Daily target ({dayTargetLabel(settings.weeklyTargetMinutes, workdayCount(settings.workdays))}) is the weekly
          target split evenly across your {workdayCount(settings.workdays)} work day
          {workdayCount(settings.workdays) === 1 ? "" : "s"}. Turning a day off hides its entries rather than deleting
          them.
        </p>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">What counts as worked time</h3>
        <div className="settings-counting-grid">
          {ENTRY_TYPES.map((type) => (
            <label key={type} className="settings-counting-row">
              <span>{ENTRY_TYPE_LABEL[type]}</span>
              <select
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
            </label>
          ))}
        </div>
        <p className="settings-hint">
          Applies retroactively — changing these re-scores every past week, so the Overview totals will shift.
          &ldquo;Subtracts&rdquo; suits time off taken against banked overtime, so it cancels out the week you earned it.
        </p>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">Timebar range</h3>
        <div className="form-row form-row-split">
          <div>
            <label htmlFor="timeline-start-input">Starts at (hour)</label>
            <input
              id="timeline-start-input"
              type="number"
              min={0}
              max={23}
              step={1}
              value={settings.timelineStartMin / 60}
              onChange={handleTimelineStartChange}
            />
          </div>
          <div>
            <label htmlFor="timeline-end-input">Ends at (hour)</label>
            <input
              id="timeline-end-input"
              type="number"
              min={1}
              max={24}
              step={1}
              value={settings.timelineEndMin / 60}
              onChange={handleTimelineEndChange}
            />
          </div>
        </div>
        <p className="settings-hint">What each day's timebar shows and how far you can drag or resize a block.</p>
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
        <p className="settings-hint">
          Backup includes your entries, settings and corrections. Restoring replaces everything — a copy of your
          current data is downloaded first.
        </p>
      </section>
      </div>
    </section>
  );
}
