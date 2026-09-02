import { useCallback, useEffect, useMemo, useState } from "react";
import { getSessions } from "../api/workSessions";
import { countedMinutes } from "../utils/entryTypeCounting";
import { addDays, getMonday, toISODate } from "../utils/dateUtils";
import type { Weekday } from "../utils/workweek";
import { useSettings } from "../contexts/SettingsContext";
import type { WorkSession } from "../types/WorkSession";
import type { CorrectionsByWeek } from "../utils/corrections";

export interface UseCarryoverResult {
  carryoverMinutes: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Running flex-time balance banked in from every earlier week: each prior
// week -- including one with nothing logged at all -- contributes (that
// week's total - the weekly target), and the balance just keeps accumulating
// (a banked surplus lowers what's required later; a deficit raises it) until
// it's worked back to zero. A week only stops counting once it's *before*
// the first week that has any activity (a session or a correction) -- that's
// "haven't started using the app yet", not a shortfall; every week from
// there on is a real week, so a completely missed one still counts as a full
// deficit rather than being silently skipped.
//
// Mirrors OverviewView's own carryover stat, but relative to whatever week is
// currently being viewed (`monday`) rather than to today -- capped at today's
// Monday, though: viewing a *future* week must not count today's still-
// in-progress week (or any other not-yet-complete week between now and then)
// as a shortfall just because it's technically "before" the viewed week.
export function useCarryoverMinutes(monday: Date, corrections: CorrectionsByWeek): UseCarryoverResult {
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

    // The first week with any activity at all -- a logged session or a
    // manual correction -- marks where tracking actually starts; everything
    // before it is out of scope, everything from it up to the cutoff (even a
    // week with nothing in totalsByWeek) is a real week to walk.
    const activeWeekIsos = [...totalsByWeek.keys(), ...Object.keys(corrections)].filter(
      (iso) => iso < cutoffMondayIso
    );
    if (activeWeekIsos.length === 0) return 0;
    const firstWeekIso = activeWeekIsos.reduce((min, iso) => (iso < min ? iso : min));

    let balance = 0;
    let cursor = new Date(`${firstWeekIso}T00:00:00`);
    while (toISODate(cursor) < cutoffMondayIso) {
      const weekIso = toISODate(cursor);
      const weekTotal = totalsByWeek.get(weekIso) ?? 0;
      const correction = corrections[weekIso] ?? 0;
      balance += weekTotal + correction - settings.weeklyTargetMinutes;
      cursor = addDays(cursor, 7);
    }
    return balance;
  }, [sessions, settings.workdays, settings.entryTypeCounting, settings.weeklyTargetMinutes, corrections, cutoffMondayIso]);

  return { carryoverMinutes, loading, error, refetch };
}
