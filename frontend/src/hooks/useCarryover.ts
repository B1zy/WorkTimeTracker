import { useCallback, useEffect, useMemo, useState } from "react";
import { getSessions } from "../api/workSessions";
import { countedMinutes } from "../utils/entryTypeCounting";
import { addDays, getMonday, toISODate } from "../utils/dateUtils";
import { workdayCount, type Weekday } from "../utils/workweek";
import { dayTargetMinutes } from "../utils/weekSummary";
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
// currently being viewed (`monday`) rather than to today. The walk itself
// always runs up to `monday` (never capped at today) -- a week fetched here
// only *contributes* to the balance if it's today's week or earlier
// (`weekIso <= todayMondayIso`); anything still ahead of today is skipped
// rather than treated as a missed week, since there's nothing to have logged
// for it yet. That distinction is what lets a week further out than "next
// week" preview correctly -- e.g. two weeks from now, this week (assuming
// it's already fully logged) counts for real, while the not-yet-started week
// in between contributes nothing, rather than reading as a full deficit just
// because it's technically "before" whatever week is being viewed.
export function useCarryoverMinutes(monday: Date, corrections: CorrectionsByWeek): UseCarryoverResult {
  const { settings } = useSettings();
  const todayMondayIso = toISODate(getMonday(new Date()));
  const mondayIso = toISODate(monday);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const endIso = toISODate(addDays(new Date(`${mondayIso}T00:00:00`), -1));
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
  }, [mondayIso]);

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
    // before it is out of scope, everything from it up to the viewed week
    // (even a week with nothing in totalsByWeek) is a real week to walk.
    const activeWeekIsos = [...totalsByWeek.keys(), ...Object.keys(corrections)].filter((iso) => iso < mondayIso);
    if (activeWeekIsos.length === 0) return 0;
    const firstWeekIso = activeWeekIsos.reduce((min, iso) => (iso < min ? iso : min));

    // A holiday on an active workday isn't a missed target -- there was
    // nothing to log -- so it shrinks that week's effective target by one
    // day's worth rather than letting the empty day register as a deficit.
    const holidaySet = new Set(settings.holidays);
    const dayTarget = dayTargetMinutes(settings.weeklyTargetMinutes, workdayCount(settings.workdays));

    let balance = 0;
    let cursor = new Date(`${firstWeekIso}T00:00:00`);
    while (toISODate(cursor) < mondayIso) {
      const weekIso = toISODate(cursor);
      if (weekIso <= todayMondayIso) {
        const weekTotal = totalsByWeek.get(weekIso) ?? 0;
        const correction = corrections[weekIso] ?? 0;
        let holidayCount = 0;
        for (let i = 0; i < 7; i++) {
          const day = addDays(cursor, i);
          if (!activeWeekdays.has(day.getDay() as Weekday)) continue;
          if (holidaySet.has(toISODate(day))) holidayCount++;
        }
        const effectiveTarget = settings.weeklyTargetMinutes - holidayCount * dayTarget;
        balance += weekTotal + correction - effectiveTarget;
      }
      cursor = addDays(cursor, 7);
    }
    return balance;
  }, [
    sessions,
    settings.workdays,
    settings.entryTypeCounting,
    settings.weeklyTargetMinutes,
    settings.holidays,
    corrections,
    mondayIso,
    todayMondayIso,
  ]);

  return { carryoverMinutes, loading, error, refetch };
}
