import { useCallback, useEffect, useState } from "react";
import { getSessions } from "../api/workSessions";
import { addDays, durationMinutes, toISODate } from "../utils/dateUtils";
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
export function useWeekData(monday: Date): UseWeekDataResult {
  const [sessionsByDate, setSessionsByDate] = useState<Record<string, WorkSession[]>>({});
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mondayIso = toISODate(monday);

  const refetch = useCallback(async () => {
    const weekStart = mondayIso;
    const weekEnd = toISODate(addDays(monday, 4));

    setLoading(true);
    try {
      const sessions = await getSessions(weekStart, weekEnd);

      const grouped: Record<string, WorkSession[]> = {};
      for (const session of sessions) {
        (grouped[session.date] ??= []).push(session);
      }

      const total = sessions
        .filter((s) => s.date >= weekStart && s.date <= weekEnd)
        .reduce((sum, s) => sum + durationMinutes(s.start, s.end), 0);

      setSessionsByDate(grouped);
      setTotalMinutes(total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
    // `monday`'s object identity can change between renders even when the
    // ISO date is the same; re-derive from `mondayIso` to avoid refetching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mondayIso]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { sessionsByDate, totalMinutes, loading, error, refetch };
}
