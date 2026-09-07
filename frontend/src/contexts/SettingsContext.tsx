import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyColorOverrides, applyMotionPreference, applyTheme, loadSettings, saveSettings, type AppSettings } from "../utils/settings";

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (updater: (prev: AppSettings) => AppSettings) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  useEffect(() => {
    applyColorOverrides(settings.colors);
    applyMotionPreference(settings.animationsEnabled);
    applyTheme(settings.theme);
    saveSettings(settings);
  }, [settings]);

  const value = useMemo(() => ({ settings, updateSettings: setSettings }), [settings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
