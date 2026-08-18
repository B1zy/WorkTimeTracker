import { useEffect, useMemo, useState } from "react";
import { getSessions } from "../api/workSessions";
import { sumCountedMinutes } from "../utils/entryTypeCounting";
import { useSettings } from "../contexts/SettingsContext";
import type { WorkSession } from "../types/WorkSession";

export interface OverviewData {
  minutesByDate: Record<string, number>;
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

  return { minutesByDate, loading, error };
}
