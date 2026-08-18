import { useMemo, useState } from "react";
import { createSession, deleteSession, getAllSessions, updateSession } from "./api/workSessions";
import { backupFilename, buildBackup, downloadJson, parseBackup } from "./utils/backup";
import { addDays, formatWeekRangeLabel, getMonday, timeRangesOverlap, timeStringToMinutes, toISODate } from "./utils/dateUtils";
import { minsToTimeStr, snapToNearestFreeSlot } from "./utils/timelineLayout";
import { weekDates } from "./utils/workweek";
import { computeWeekSummary, targetMarkerPercent } from "./utils/weekSummary";
import { useWeekData } from "./hooks/useWeekData";
import { useSessionDialog } from "./hooks/useSessionDialog";
import { useWeekCorrections } from "./hooks/useWeekCorrections";
import { useSettings } from "./contexts/SettingsContext";
import { WeekHeader } from "./components/WeekHeader";
import { ErrorBanner } from "./components/ErrorBanner";
import { WeekRows } from "./components/WeekRows";
import { SessionDialog } from "./components/SessionDialog";
import { TopNav, type AppView } from "./components/TopNav";
import { OverviewView } from "./components/OverviewView";
import type { NewWorkSession, WorkSession } from "./types/WorkSession";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Deletes are issued one at a time rather than in parallel: the backend is
// SQLite, which allows only a single writer, so concurrent DELETEs make its
// SaveChanges() calls collide and fail with "database is locked".
async function deleteSessionsSequentially(ids: number[]): Promise<void> {
  for (const id of ids) {
    await deleteSession(id);
  }
}

function App() {
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [view, setView] = useState<AppView>("week");

  const { settings, updateSettings } = useSettings();
  const { sessionsByDate, totalMinutes, error: fetchError, refetch } = useWeekData(currentMonday);
  const dialog = useSessionDialog();
  const { corrections, getCorrection, setCorrection, replaceAll: replaceCorrections } = useWeekCorrections();

  const mondayIso = useMemo(() => toISODate(currentMonday), [currentMonday]);
  const correctionMinutes = getCorrection(mondayIso);
  const weekDays = useMemo(() => weekDates(currentMonday, settings.workdays), [currentMonday, settings.workdays]);
  const weekRangeLabel = useMemo(
    () => formatWeekRangeLabel(weekDays[0], weekDays[weekDays.length - 1]),
    [weekDays]
  );
  const summary = useMemo(
    () => computeWeekSummary(totalMinutes, correctionMinutes, settings.weeklyTargetMinutes),
    [totalMinutes, correctionMinutes, settings.weeklyTargetMinutes]
  );

  const error = mutationError ?? fetchError;

  // True if `candidate` (start/end/date, optionally excluding an existing id)
  // overlaps any other session already on that same day.
  function hasOverlap(candidate: { date: string; start: string; end: string }, excludeId: number | null): boolean {
    const daySessions = sessionsByDate[candidate.date] ?? [];
    return daySessions.some(
      (s) => s.id !== excludeId && timeRangesOverlap(candidate.start, candidate.end, s.start, s.end)
    );
  }

  function handlePrevWeek() {
    setCurrentMonday((monday) => addDays(monday, -7));
  }

  function handleNextWeek() {
    setCurrentMonday((monday) => addDays(monday, 7));
  }

  function handleSelectWeek(monday: Date) {
    setCurrentMonday(monday);
  }

  function handleCorrectionChange(value: number) {
    setCorrection(mondayIso, value);
  }

  function handleAddClick(dateIso: string, dateObj: Date, startTime?: string | null, endTime?: string | null) {
    dialog.openCreate(dateIso, dateObj, startTime ?? null, endTime ?? null, async (session) => {
      setMutationError(null);
      if (hasOverlap(session, null)) {
        setMutationError("This session overlaps an existing one.");
        return false;
      }
      try {
        await createSession(session);
        await refetch();
        return true;
      } catch (err) {
        setMutationError(errorMessage(err));
        return false;
      }
    });
  }

  function handleSessionClick(session: WorkSession) {
    // "T00:00:00" forces this to parse as local time instead of UTC, so the
    // dialog's date label can't drift to the wrong day near midnight.
    const dateObj = new Date(`${session.date}T00:00:00`);

    dialog.openEdit(
      session,
      dateObj,
      async (updated: NewWorkSession, id: number) => {
        setMutationError(null);
        if (hasOverlap(updated, id)) {
          setMutationError("This session overlaps an existing one.");
          return false;
        }
        try {
          await updateSession(id, { ...updated, id });
          await refetch();
          return true;
        } catch (err) {
          setMutationError(errorMessage(err));
          return false;
        }
      },
      async () => {
        setMutationError(null);
        try {
          await deleteSession(session.id);
          await refetch();
          return true;
        } catch (err) {
          setMutationError(errorMessage(err));
          return false;
        }
      }
    );
  }

  // Called after a session block is dragged to a new position on the
  // timeline (or resized via its edge handles). Returns true/false so the
  // block knows whether to keep the change or revert it.
  async function handleSessionMove(session: WorkSession, newStart: string, newEnd: string): Promise<boolean> {
    let candidate = { ...session, start: newStart, end: newEnd };

    if (hasOverlap(candidate, session.id)) {
      // Rather than reverting all the way back to where the drag started,
      // slide the block to just touch the nearest blocking edge.
      const siblings = (sessionsByDate[session.date] ?? [])
        .filter((s) => s.id !== session.id)
        .map((s) => ({ start: timeStringToMinutes(s.start), end: timeStringToMinutes(s.end) }));
      const snapped = snapToNearestFreeSlot(
        timeStringToMinutes(newStart),
        timeStringToMinutes(newEnd) - timeStringToMinutes(newStart),
        timeStringToMinutes(session.start),
        siblings,
        settings.timelineStartMin,
        settings.timelineEndMin
      );
      if (!snapped) {
        setMutationError("This session overlaps an existing one.");
        return false;
      }
      candidate = { ...session, start: minsToTimeStr(snapped.start), end: minsToTimeStr(snapped.end) };
    }

    try {
      setMutationError(null);
      await updateSession(session.id, candidate);
      await refetch();
      return true;
    } catch (err) {
      setMutationError(errorMessage(err));
      return false;
    }
  }

  async function handleRemoveAllClick(dateIso: string) {
    const daySessions = sessionsByDate[dateIso] ?? [];
    if (daySessions.length === 0) return;

    try {
      setMutationError(null);
      await deleteSessionsSequentially(daySessions.map((s) => s.id));
      await refetch();
    } catch (err) {
      setMutationError(errorMessage(err));
    }
  }

  async function handleClearAllData() {
    try {
      setMutationError(null);
      const all = await getAllSessions();
      await deleteSessionsSequentially(all.map((s) => s.id));
      await refetch();
    } catch (err) {
      setMutationError(errorMessage(err));
    }
  }

  async function handleExportData() {
    setMutationError(null);
    const all = await getAllSessions();
    downloadJson(backupFilename(), buildBackup(all, settings, corrections));
  }

  // Replace-only restore. Takes a safety copy of the current state first --
  // this wipes everything, and "Clear all data" already taught that lesson.
  async function handleImportData(
    file: File,
    onProgress?: (done: number, total: number) => void
  ): Promise<{ imported: number; failed: number }> {
    setMutationError(null);
    const backup = parseBackup(await file.text());

    const existing = await getAllSessions();
    downloadJson(backupFilename("worktimetracker-pre-restore"), buildBackup(existing, settings, corrections));

    await deleteSessionsSequentially(existing.map((s) => s.id));

    // Sequential, and failures are collected rather than aborting: one bad row
    // shouldn't strand the restore half-done.
    let imported = 0;
    let failed = 0;
    for (const [index, session] of backup.sessions.entries()) {
      try {
        await createSession(session);
        imported++;
      } catch {
        failed++;
      }
      onProgress?.(index + 1, backup.sessions.length);
    }

    if (backup.settings) updateSettings(() => backup.settings);
    if (backup.corrections) replaceCorrections(backup.corrections);
    await refetch();

    if (failed > 0) setMutationError(`${failed} of ${backup.sessions.length} entries could not be restored.`);
    return { imported, failed };
  }

  return (
    <>
      <div className="app">
        <TopNav view={view} onChangeView={setView} />

        {view === "week" ? (
          <>
            <WeekHeader
              currentMonday={currentMonday}
              weekRangeLabel={weekRangeLabel}
              onPrevWeek={handlePrevWeek}
              onNextWeek={handleNextWeek}
              onSelectWeek={handleSelectWeek}
              adjustedMinutes={summary.adjustedMinutes}
              state={summary.state}
              label={summary.label}
              fillPercent={summary.fillPercent}
              targetPercent={targetMarkerPercent(settings.weeklyTargetMinutes)}
              correctionMinutes={correctionMinutes}
              onCorrectionChange={handleCorrectionChange}
            />

            <ErrorBanner message={error} />

            <WeekRows
              weekDays={weekDays}
              sessionsByDate={sessionsByDate}
              onAddClick={handleAddClick}
              onSessionClick={handleSessionClick}
              onSessionMove={handleSessionMove}
              onRemoveAllClick={handleRemoveAllClick}
            />
          </>
        ) : (
          <OverviewView
            onClearAllData={handleClearAllData}
            onExportData={handleExportData}
            onImportData={handleImportData}
          />
        )}
      </div>

      <SessionDialog state={dialog.state} onClose={dialog.close} />
    </>
  );
}

export default App;
