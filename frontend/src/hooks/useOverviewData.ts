import { useEffect, useState } from "react";
import { getSessions } from "../api/workSessions";
import { durationMinutes } from "../utils/dateUtils";

export interface OverviewData {
  minutesByDate: Record<string, number>;
  loading: boolean;
  error: string | null;
}

// Fetches every session in [startIso, endIso] and aggregates total tracked
// minutes per date, for the Overview contribution chart.
export function useOverviewData(startIso: string, endIso: string): OverviewData {
  const [minutesByDate, setMinutesByDate] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getSessions(startIso, endIso)
      .then((sessions) => {
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const s of sessions) {
          map[s.date] = (map[s.date] ?? 0) + durationMinutes(s.start, s.end);
        }
        setMinutesByDate(map);
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

  return { minutesByDate, loading, error };
}
