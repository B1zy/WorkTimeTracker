import { useEffect, useState } from "react";
import { loadRecordingStart, saveRecordingStart } from "../utils/liveRecording";

export interface LiveRecordingResult {
  isRecording: boolean;
  // Minutes elapsed since the recording started, live-ticking. 0 when idle.
  elapsedMinutes: number;
  start: () => void;
  // Ends the recording and hands back the [start, end) pair so the caller can
  // turn it into a work session; returns null if nothing was in progress.
  stop: () => { start: Date; end: Date } | null;
}

// Backs the status-indicator's clock-in/out button (see WeekHeader). Kept as
// its own hook (rather than local state in App) so the persisted-start-time
// bookkeeping and the once-a-minute re-render it needs for a live elapsed
// label stay in one place.
export function useLiveRecording(): LiveRecordingResult {
  const [recordingStart, setRecordingStart] = useState<Date | null>(() => loadRecordingStart());
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!recordingStart) return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [recordingStart]);

  function start() {
    const now = new Date();
    saveRecordingStart(now);
    setRecordingStart(now);
  }

  function stop() {
    if (!recordingStart) return null;
    const end = new Date();
    saveRecordingStart(null);
    setRecordingStart(null);
    return { start: recordingStart, end };
  }

  const elapsedMinutes = recordingStart ? Math.max(0, Math.floor((Date.now() - recordingStart.getTime()) / 60_000)) : 0;

  return { isRecording: recordingStart !== null, elapsedMinutes, start, stop };
}
