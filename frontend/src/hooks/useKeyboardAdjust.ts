// Keyboard move/resize for a focused timeline block, so the timeline is
// operable without a pointer.
//
//   Left / Right            move the whole block by 5 minutes
//   Shift + Left / Right    move the END edge
//   Alt   + Left / Right    move the START edge
//   Escape                  discard a pending (unsaved) adjustment
//
// Every keystroke is clamped against the same sibling bounds the drag hooks
// use, so the keyboard path can never *produce* an overlap. The visual update
// is applied imperatively (as the drag hooks do) and the save is debounced --
// key auto-repeat would otherwise fire one PUT plus a full refetch per repeat.

import { useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import type { WorkSession } from "../types/WorkSession";
import { formatDuration, formatTimeShort } from "../utils/dateUtils";
import { minsToTimeStr, minutesToPercent } from "../utils/timelineLayout";
import { useLiveAnnouncer } from "./useLiveAnnouncer";

const STEP_MIN = 5;
const MIN_DURATION_MIN = 5;
const SAVE_DEBOUNCE_MS = 400;

interface UseKeyboardAdjustOptions {
  blockRef: RefObject<HTMLButtonElement | null>;
  session: WorkSession;
  startMins: number;
  endMins: number;
  leftBoundMins: number;
  rightBoundMins: number;
  rangeStartMin: number;
  rangeEndMin: number;
  onSessionMove: (session: WorkSession, newStart: string, newEnd: string) => Promise<boolean>;
}

export function useKeyboardAdjust({
  blockRef,
  session,
  startMins,
  endMins,
  leftBoundMins,
  rightBoundMins,
  rangeStartMin,
  rangeEndMin,
  onSessionMove,
}: UseKeyboardAdjustOptions) {
  const { announce } = useLiveAnnouncer();
  const pendingRef = useRef<{ start: number; end: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const flush = useCallback(() => {
    clearTimer();
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;
    if (pending.start === startMins && pending.end === endMins) return;
    void onSessionMove(session, minsToTimeStr(pending.start), minsToTimeStr(pending.end));
  }, [clearTimer, onSessionMove, session, startMins, endMins]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Escape") {
        if (!pendingRef.current) return;
        clearTimer();
        pendingRef.current = null;
        const block = blockRef.current;
        if (block) {
          const left = minutesToPercent(startMins, rangeStartMin, rangeEndMin);
          const right = minutesToPercent(endMins, rangeStartMin, rangeEndMin);
          block.style.left = `${left}%`;
          block.style.width = `${Math.max(right - left, 1)}%`;
        }
        announce("Adjustment discarded.");
        event.preventDefault();
        return;
      }

      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

      // Alt+Arrow is browser-back on Windows; claim every combination we handle.
      event.preventDefault();

      const direction = event.key === "ArrowLeft" ? -STEP_MIN : STEP_MIN;
      const current = pendingRef.current ?? { start: startMins, end: endMins };
      let { start, end } = current;

      if (event.altKey) {
        start = Math.min(Math.max(start + direction, leftBoundMins), end - MIN_DURATION_MIN);
      } else if (event.shiftKey) {
        end = Math.max(Math.min(end + direction, rightBoundMins), start + MIN_DURATION_MIN);
      } else {
        const duration = end - start;
        start = Math.min(Math.max(start + direction, leftBoundMins), rightBoundMins - duration);
        end = start + duration;
      }

      pendingRef.current = { start, end };

      const block = blockRef.current;
      if (block) {
        const left = minutesToPercent(start, rangeStartMin, rangeEndMin);
        const right = minutesToPercent(end, rangeStartMin, rangeEndMin);
        block.style.left = `${left}%`;
        block.style.width = `${Math.max(right - left, 1)}%`;
      }

      announce(
        `${formatTimeShort(minsToTimeStr(start))} to ${formatTimeShort(minsToTimeStr(end))}, ${formatDuration(end - start)}`
      );

      clearTimer();
      timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [
      blockRef,
      startMins,
      endMins,
      leftBoundMins,
      rightBoundMins,
      rangeStartMin,
      rangeEndMin,
      announce,
      clearTimer,
      flush,
    ]
  );

  // Commit immediately if focus leaves mid-adjustment.
  const onBlur = useCallback(() => flush(), [flush]);

  return { onKeyDown, onBlur };
}
