import { useCallback, useEffect, useMemo, useState } from "react";
import { getSessions } from "../api/workSessions";
import { addDays, toISODate } from "../utils/dateUtils";
import { sumCountedMinutes } from "../utils/entryTypeCounting";
import { weekDates } from "../utils/workweek";
import { useSettings } from "../contexts/SettingsContext";
import type { WorkSession } from "../types/WorkSession";

export interface UseWeekDataResult {
  sessionsByDate: Record<string, WorkSession[]>;
  totalMinutes: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Fetches the given week's sessions and groups them by ISO date. `refetch` is
// also called directly after create/update/delete mutations elsewhere in the
// app, so a fetch failure here is kept separate from mutation errors (the
// caller combines the two for display).
//
// `totalMinutes` is *derived*, not stored: it depends on the entry-type
// counting settings, which can change without any network activity.
export function useWeekData(monday: Date): UseWeekDataResult {
  const { settings } = useSettings();
  const [sessionsByDate, setSessionsByDate] = useState<Record<string, WorkSession[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mondayIso = toISODate(monday);

  const refetch = useCallback(async () => {
    const weekStart = mondayIso;
    // Always fetch the whole Mon..Sun span, not just the active work days, so
    // that narrowing the work week hides entries rather than orphaning them.
    const weekEnd = toISODate(addDays(new Date(`${mondayIso}T00:00:00`), 6));

    setLoading(true);
    try {
      const sessions = await getSessions(weekStart, weekEnd);

      const grouped: Record<string, WorkSession[]> = {};
      for (const session of sessions) {
        (grouped[session.date] ??= []).push(session);
      }

      setSessionsByDate(grouped);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [mondayIso]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Only the active work days contribute, so the header total always equals
  // the sum of the visible day rows.
  const totalMinutes = useMemo(() => {
    const mondayDate = new Date(`${mondayIso}T00:00:00`);
    const activeIsoDates = new Set(weekDates(mondayDate, settings.workdays).map(toISODate));

    return Object.entries(sessionsByDate)
      .filter(([iso]) => activeIsoDates.has(iso))
      .reduce((sum, [, sessions]) => sum + sumCountedMinutes(sessions, settings.entryTypeCounting), 0);
  }, [sessionsByDate, mondayIso, settings.workdays, settings.entryTypeCounting]);

  return { sessionsByDate, totalMinutes, loading, error, refetch };
}
