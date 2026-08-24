import { useCallback, useEffect, useMemo, useState } from "react";
import { getSessions } from "../api/workSessions";
import { countedMinutes } from "../utils/entryTypeCounting";
import { addDays, getMonday, toISODate } from "../utils/dateUtils";
import type { Weekday } from "../utils/workweek";
import { useSettings } from "../contexts/SettingsContext";
import type { WorkSession } from "../types/WorkSession";

export interface UseCarryoverResult {
  carryoverMinutes: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Running flex-time balance banked in from every earlier week: each prior
// week that has entries contributes (that week's total - the weekly target),
// and the balance just keeps accumulating (a banked surplus lowers what's
// required later; a deficit raises it) until it's worked back to zero. Weeks
// with no entries at all don't count either way -- they haven't happened
// yet, not a shortfall.
//
// Mirrors OverviewView's own carryover stat, but relative to whatever week is
// currently being viewed (`monday`) rather than to today -- capped at today's
// Monday, though: viewing a *future* week must not count today's still-
// in-progress week (or any other not-yet-complete week between now and then)
// as a shortfall just because it's technically "before" the viewed week.
export function useCarryoverMinutes(monday: Date): UseCarryoverResult {
  const { settings } = useSettings();
  const todayMonday = getMonday(new Date());
  const cutoffMonday = monday < todayMonday ? monday : todayMonday;
  const cutoffMondayIso = toISODate(cutoffMonday);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const endIso = toISODate(addDays(new Date(`${cutoffMondayIso}T00:00:00`), -1));
    setLoading(true);
    try {
      const fetched = await getSessions("1970-01-01", endIso);
      setSessions(fetched);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [cutoffMondayIso]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const carryoverMinutes = useMemo(() => {
    const activeWeekdays = new Set(settings.workdays);
    const totalsByWeek = new Map<string, number>();

    for (const session of sessions) {
      const date = new Date(`${session.date}T00:00:00`);
      if (!activeWeekdays.has(date.getDay() as Weekday)) continue;

      const weekIso = toISODate(getMonday(date));
      const minutes = countedMinutes(session, settings.entryTypeCounting);
      totalsByWeek.set(weekIso, (totalsByWeek.get(weekIso) ?? 0) + minutes);
    }

    let balance = 0;
    for (const weekTotal of totalsByWeek.values()) {
      balance += weekTotal - settings.weeklyTargetMinutes;
    }
    return balance;
  }, [sessions, settings.workdays, settings.entryTypeCounting, settings.weeklyTargetMinutes]);

  return { carryoverMinutes, loading, error, refetch };
}
