import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useSettings } from "../contexts/SettingsContext";
import {
  COLOR_LABEL,
  DEFAULT_COLORS,
  ENTRY_TYPE_COLOR_KEYS,
  LOCATION_COLOR_KEYS,
  type SettingsColors,
} from "../utils/settings";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onClearAllData: () => Promise<void>;
}

export function SettingsPanel({ isOpen, onClose, onClearAllData }: SettingsPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { settings, updateSettings } = useSettings();
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setConfirmingClear(false);
  }, [isOpen]);

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

  function handleColorChange(key: keyof SettingsColors, value: string) {
    updateSettings((prev) => ({ ...prev, colors: { ...prev.colors, [key]: value } }));
  }

  function handleResetColors() {
    updateSettings((prev) => ({ ...prev, colors: { ...DEFAULT_COLORS } }));
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
    <dialog ref={dialogRef} className="session-dialog settings-dialog" onCancel={onClose}>
      <h2 id="settings-title">Settings</h2>

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
        <p className="settings-hint">
          Daily target ({(settings.weeklyTargetMinutes / 60 / 5).toFixed(1)}h) is this split evenly across a 5-day week.
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
        <div className="settings-section-heading-row">
          <h3 className="settings-section-title">Location colors</h3>
          <button type="button" className="settings-reset-btn" onClick={handleResetColors}>
            Reset all to default
          </button>
        </div>
        <div className="settings-color-grid">
          {LOCATION_COLOR_KEYS.map((key) => (
            <label key={key} className="settings-color-row">
              <span>{COLOR_LABEL[key]}</span>
              <input
                type="color"
                value={settings.colors[key]}
                onChange={(e) => handleColorChange(key, e.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">Entry type colors</h3>
        <div className="settings-color-grid">
          {ENTRY_TYPE_COLOR_KEYS.map((key) => (
            <label key={key} className="settings-color-row">
              <span>{COLOR_LABEL[key]}</span>
              <input
                type="color"
                value={settings.colors[key]}
                onChange={(e) => handleColorChange(key, e.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-section-title">Data</h3>
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

      <div className="dialog-actions">
        <div />
        <div className="dialog-actions-right">
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
