import { useEffect, useMemo, useState } from "react";
import { getSessions } from "../api/workSessions";
import { sumCountedMinutes } from "../utils/entryTypeCounting";
import { useSettings } from "../contexts/SettingsContext";
import { durationMinutes } from "../utils/dateUtils";
import type { EntryType, WorkSession } from "../types/WorkSession";

export interface OverviewData {
  minutesByDate: Record<string, number>;
  // Raw (un-weighted) session duration per date, broken down by entry type --
  // the composition view, as opposed to minutesByDate's counted total.
  minutesByDateAndType: Record<string, Partial<Record<EntryType, number>>>;
  loading: boolean;
  error: string | null;
}

// Fetches every session in [startIso, endIso] and aggregates counted minutes
// per date, for the Overview contribution chart.
//
// The raw sessions are held in state and the per-date totals derived, so that
// changing the entry-type counting settings re-scores the chart immediately
// rather than waiting for the next fetch.
export function useOverviewData(startIso: string, endIso: string): OverviewData {
  const { settings } = useSettings();
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getSessions(startIso, endIso)
      .then((fetched) => {
        if (!cancelled) setSessions(fetched);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [startIso, endIso]);

  const minutesByDate = useMemo(() => {
    const byDate: Record<string, WorkSession[]> = {};
    for (const session of sessions) {
      (byDate[session.date] ??= []).push(session);
    }

    const map: Record<string, number> = {};
    for (const [date, daySessions] of Object.entries(byDate)) {
      map[date] = sumCountedMinutes(daySessions, settings.entryTypeCounting);
    }
    return map;
  }, [sessions, settings.entryTypeCounting]);

  const minutesByDateAndType = useMemo(() => {
    const map: Record<string, Partial<Record<EntryType, number>>> = {};
    for (const session of sessions) {
      const byType = (map[session.date] ??= {});
      byType[session.entryType] = (byType[session.entryType] ?? 0) + durationMinutes(session.start, session.end);
    }
    return map;
  }, [sessions]);

  return { minutesByDate, minutesByDateAndType, loading, error };
}
