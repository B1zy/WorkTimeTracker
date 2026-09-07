import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useSettings } from "../contexts/SettingsContext";
import { useWeather } from "../contexts/WeatherContext";
import {
  COUNTING_MODES,
  COUNTING_MODE_LABEL,
  type CountingMode,
} from "../utils/entryTypeCounting";
import { WEEKDAY_DISPLAY_ORDER, WEEKDAY_LABEL, type Weekday } from "../utils/workweek";
import { ENTRY_TYPE_LABEL } from "../utils/timelineLayout";
import { TimeField } from "./TimeField";
import type { EntryType } from "../types/WorkSession";

const ENTRY_TYPES: EntryType[] = ["Working", "Sick", "OvertimeCompensation", "Appointment", "Lunch", "Vacation"];

// Shortened only for this settings list, where a fixed label column leaves no
// room for the full name to avoid wrapping -- everywhere else (timeline
// titles, aria-labels) still uses the full ENTRY_TYPE_LABEL.
const SETTINGS_ENTRY_TYPE_LABEL: Partial<Record<EntryType, string>> = {
  OvertimeCompensation: "Overtime comp.",
};

const DAY_MINUTES = 24 * 60;

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
//
// A plain, fixed-order stack of category cards -- after trying a
// drag-to-reorder grid and then a freeform drag canvas, both proved less
// intuitive than a settings page just always looking the same: every
// control always lives in the same place, grouped by what it actually
// affects, with no layout step of its own to think about.
export function SettingsPanel({ onClearAllData, onExportData, onImportData }: SettingsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { settings, updateSettings } = useSettings();
  const { location, loading: weatherLoading, error: weatherError, permissionDenied, requestLocation, clearLocation } = useWeather();
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [newHoliday, setNewHoliday] = useState("");

  function handleTargetHoursChange(event: ChangeEvent<HTMLInputElement>) {
    const hours = Number(event.target.value);
    if (!Number.isFinite(hours) || hours <= 0) return;
    updateSettings((prev) => ({ ...prev, weeklyTargetMinutes: Math.round(hours * 60) }));
  }

  function handleTimelineStartChange(mins: number) {
    updateSettings((prev) => ({ ...prev, timelineStartMin: Math.min(mins, prev.timelineEndMin - 60) }));
  }

  function handleTimelineEndChange(mins: number) {
    updateSettings((prev) => ({ ...prev, timelineEndMin: Math.max(mins, prev.timelineStartMin + 60) }));
  }

  function handleToggleAnimations() {
    updateSettings((prev) => ({ ...prev, animationsEnabled: !prev.animationsEnabled }));
  }

  function handleToggleTheme() {
    updateSettings((prev) => ({ ...prev, theme: prev.theme === "light" ? "dark" : "light" }));
  }

  function handleVacationDaysChange(event: ChangeEvent<HTMLInputElement>) {
    const days = Number(event.target.value);
    if (!Number.isFinite(days) || days < 0) return;
    updateSettings((prev) => ({ ...prev, vacationDaysPerYear: days }));
  }

  function handleAddHoliday() {
    if (!newHoliday) return;
    updateSettings((prev) =>
      prev.holidays.includes(newHoliday) ? prev : { ...prev, holidays: [...prev.holidays, newHoliday].sort() }
    );
    setNewHoliday("");
  }

  function handleRemoveHoliday(date: string) {
    updateSettings((prev) => ({ ...prev, holidays: prev.holidays.filter((d) => d !== date) }));
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

  const cards: ReactNode = (
    <>
      <section className="settings-section" style={{ order: 1 }}>
        <h3 className="settings-section-title">Work week</h3>
        <div className="settings-row-grid">
          <div className="settings-row">
            <label htmlFor="weekly-target-input" className="settings-row-label">
              Weekly target
            </label>
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
          <div className="settings-row">
            <span className="settings-row-label" id="workdays-label">
              Work days
            </span>
            <div className="settings-weekday-row" role="group" aria-labelledby="workdays-label">
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
        </div>
      </section>

      <section className="settings-section" style={{ order: 3 }}>
        <h3 className="settings-section-title">What counts as worked time</h3>
        <div className="settings-row-grid">
          {ENTRY_TYPES.map((type) => (
            <div key={type} className="settings-row">
              <label htmlFor={`counting-${type}`} className="settings-row-label">
                {SETTINGS_ENTRY_TYPE_LABEL[type] ?? ENTRY_TYPE_LABEL[type]}
              </label>
              <select
                id={`counting-${type}`}
                className="settings-row-select"
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

      <section className="settings-section" style={{ order: 4 }}>
        <h3 className="settings-section-title">Display</h3>
        <div className="settings-row-grid">
          <div className="settings-row">
            <span className="settings-row-label">Timebar range</span>
            <div className="settings-time-range-row">
              <TimeField
                id="timeline-start-input"
                value={settings.timelineStartMin}
                onChange={handleTimelineStartChange}
                ariaLabel="Starts at"
                compact
              />
              <span className="settings-time-range-to">to</span>
              <TimeField
                id="timeline-end-input"
                value={settings.timelineEndMin}
                onChange={handleTimelineEndChange}
                ariaLabel="Ends at"
                compact
              />
            </div>
          </div>
          <div className="settings-time-range-preview settings-row-full">
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

          <div className="settings-row">
            <span className="settings-row-label">Weather icons</span>
            <div className="settings-weather-row">
              {location ? (
                <>
                  <span className="settings-weather-status">
                    Location set ({location.lat.toFixed(2)}, {location.lon.toFixed(2)})
                  </span>
                  <button type="button" className="btn-secondary" onClick={clearLocation}>
                    Turn off
                  </button>
                </>
              ) : (
                <button type="button" className="btn-secondary" onClick={requestLocation} disabled={weatherLoading}>
                  {weatherLoading ? "Requesting…" : "Use my location"}
                </button>
              )}
            </div>
          </div>
          <p className="settings-hint settings-row-full">
            Shows a small forecast icon next to each day. Uses your browser's location, sent to this app's own
            backend, which looks up the forecast for you.
          </p>
          {weatherError && (
            <p className="settings-hint settings-weather-error settings-row-full">
              {weatherError}
              {permissionDenied && " You can re-enable location access for this site in your browser's settings."}
            </p>
          )}

          <div className="settings-row">
            <label htmlFor="animations-toggle" className="settings-row-label">
              Animations
            </label>
            <button
              id="animations-toggle"
              type="button"
              className={`settings-toggle-btn${settings.animationsEnabled ? " is-on" : ""}`}
              aria-pressed={settings.animationsEnabled}
              onClick={handleToggleAnimations}
            >
              {settings.animationsEnabled ? "On" : "Off"}
            </button>
          </div>

          <div className="settings-row">
            <label htmlFor="theme-toggle" className="settings-row-label">
              Theme
            </label>
            <button
              id="theme-toggle"
              type="button"
              className={`settings-toggle-btn${settings.theme === "light" ? " is-on" : ""}`}
              aria-pressed={settings.theme === "light"}
              onClick={handleToggleTheme}
            >
              {settings.theme === "light" ? "Light" : "Dark"}
            </button>
          </div>
        </div>
      </section>

      <section className="settings-section" style={{ order: 5 }}>
        <h3 className="settings-section-title">Time off &amp; holidays</h3>
        <div className="settings-row-grid">
          <div className="settings-row">
            <label htmlFor="vacation-days-input" className="settings-row-label">
              Vacation days / year
            </label>
            <div className="settings-input-with-unit">
              <input
                id="vacation-days-input"
                type="number"
                min={0}
                step={0.5}
                value={settings.vacationDaysPerYear}
                onChange={handleVacationDaysChange}
              />
              <span className="settings-input-unit">days</span>
            </div>
          </div>

          <div className="settings-row settings-row-full">
            <span className="settings-row-label" id="holidays-label">
              Public holidays
            </span>
            <div className="settings-holiday-add" role="group" aria-labelledby="holidays-label">
              <input
                type="date"
                value={newHoliday}
                onChange={(e) => setNewHoliday(e.target.value)}
                aria-label="Holiday date"
              />
              <button type="button" className="btn-secondary" onClick={handleAddHoliday} disabled={!newHoliday}>
                Add
              </button>
            </div>
            {settings.holidays.length > 0 && (
              <ul className="settings-holiday-list">
                {settings.holidays.map((date) => (
                  <li key={date} className="settings-holiday-item">
                    <span>{date}</span>
                    <button
                      type="button"
                      className="settings-holiday-remove"
                      onClick={() => handleRemoveHoliday(date)}
                      aria-label={`Remove ${date}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="settings-hint settings-row-full">
            An empty day on one of these dates isn't counted as a missed target in your carried-over balance.
          </p>
        </div>
      </section>

      <section className="settings-section" style={{ order: 2 }}>
        <h3 className="settings-section-title">Data &amp; backup</h3>
        <div className="settings-row-grid">
          <div className="settings-row">
            <span className="settings-row-label">Backup</span>
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
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={handleFileChosen}
              />
            </div>
          </div>
          {status && <p className="settings-hint settings-backup-status settings-row-full">{status}</p>}

          <hr className="settings-divider settings-row-full" />

          <div className="settings-row">
            <span className="settings-row-label">Danger zone</span>
            <div className="settings-danger-actions">
              <button
                type="button"
                className={`btn-delete settings-clear-btn${confirmingClear ? " is-confirming" : ""}`}
                onClick={handleClearAllData}
                disabled={clearing}
              >
                {confirmingClear ? "Really delete everything? Click again to confirm" : "Clear all data"}
              </button>
              {confirmingClear && (
                <button
                  type="button"
                  className="btn-secondary settings-clear-cancel"
                  onClick={() => setConfirmingClear(false)}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );

  return (
    <section className="settings-inline">
      <div className="settings-section-heading-row">
        <h2 id="settings-title">Settings</h2>
      </div>
      <div className="settings-panel-list">{cards}</div>
    </section>
  );
}
