import { useSettings } from "../contexts/SettingsContext";
import { COLOR_LABEL, DEFAULT_COLORS, ENTRY_TYPE_COLOR_KEYS, LOCATION_COLOR_KEYS, type SettingsColors } from "../utils/settings";

// The "vertical stroke" of the settings L-shape: a couple of short,
// self-contained sections (both just color pickers) sized to sit beside the
// charts rather than below them, stretched (via CSS) to match the main
// overview panel's height. See SettingsPanel for the rest -- split out
// specifically so its content stays independent of the other four sections,
// which flow into their own full-width row below instead.
export function SettingsSidebar() {
  const { settings, updateSettings } = useSettings();

  function handleColorChange(key: keyof SettingsColors, value: string) {
    updateSettings((prev) => ({ ...prev, colors: { ...prev.colors, [key]: value } }));
  }

  function handleResetColors() {
    updateSettings((prev) => ({ ...prev, colors: { ...DEFAULT_COLORS } }));
  }

  return (
    <section className="settings-inline settings-sidebar">
      <div className="settings-section-heading-row">
        <h2 id="settings-sidebar-title" className="settings-sidebar-title">
          Colors
        </h2>
        <button type="button" className="settings-reset-btn" onClick={handleResetColors}>
          Reset
        </button>
      </div>

      <div className="settings-sidebar-sections">
        <section className="settings-section">
          <h3 className="settings-section-title">Location colors</h3>
          <div className="settings-color-grid">
            {LOCATION_COLOR_KEYS.map((key) => (
              <label key={key} className="settings-color-row">
                <span>{COLOR_LABEL[key]}</span>
                <input type="color" value={settings.colors[key]} onChange={(e) => handleColorChange(key, e.target.value)} />
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
                <input type="color" value={settings.colors[key]} onChange={(e) => handleColorChange(key, e.target.value)} />
              </label>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
