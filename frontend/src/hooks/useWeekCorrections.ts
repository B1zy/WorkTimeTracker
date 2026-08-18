import { useCallback, useEffect, useState } from "react";
import { loadCorrections, saveCorrections, type CorrectionsByWeek } from "../utils/corrections";

export interface UseWeekCorrectionsResult {
  corrections: CorrectionsByWeek;
  getCorrection: (mondayIso: string) => number;
  setCorrection: (mondayIso: string, minutes: number) => void;
  /** Wholesale replacement, used when restoring from a backup. */
  replaceAll: (next: CorrectionsByWeek) => void;
}

// Mirrors SettingsProvider's persistence shape (lazy load + save-on-change),
// but as a plain hook rather than a context: only App consumes it.
export function useWeekCorrections(): UseWeekCorrectionsResult {
  const [corrections, setCorrections] = useState<CorrectionsByWeek>(() => loadCorrections());

  useEffect(() => {
    saveCorrections(corrections);
  }, [corrections]);

  const getCorrection = useCallback((mondayIso: string) => corrections[mondayIso] ?? 0, [corrections]);

  const setCorrection = useCallback((mondayIso: string, minutes: number) => {
    setCorrections((prev) => ({ ...prev, [mondayIso]: minutes }));
  }, []);

  const replaceAll = useCallback((next: CorrectionsByWeek) => {
    setCorrections(next);
  }, []);

  return { corrections, getCorrection, setCorrection, replaceAll };
}
