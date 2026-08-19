// Drag-to-move: repositions an existing session block, preserving its
// duration. The block's position is mutated directly via its ref during the
// drag (not React state), matching useDragToSelect's approach. Clamped in
// real time against sibling sessions (like resize already was) so the block
// can never be dragged into visual overlap in the first place -- what you
// see mid-drag is always a valid drop position, so there's no separate
// "oops, that overlapped, let me guess where you meant" correction after
// release that could guess wrong.

import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { WorkSession } from "../types/WorkSession";
import { formatTimeShort } from "../utils/dateUtils";
import { minsToTimeStr, minutesToPercent, snapToNearestFreeSlot, type MinuteInterval } from "../utils/timelineLayout";
import { useDragTooltip } from "./useDragTooltip";
import { beginPointerDrag } from "./pointerDrag";

// Minimum pointer movement before a press on a session block counts as a
// drag-to-move rather than a plain click (which opens the edit modal).
// A finger is far less steady than a mouse, hence the larger touch threshold.
const MOUSE_MOVE_THRESHOLD_PX = 4;
const TOUCH_MOVE_THRESHOLD_PX = 10;

interface UseDragToMoveOptions {
  trackRef: RefObject<HTMLDivElement | null>;
  blockRef: RefObject<HTMLButtonElement | null>;
  session: WorkSession;
  startMins: number;
  endMins: number;
  leftPercent: number;
  rangeStartMin: number;
  rangeEndMin: number;
  siblings: MinuteInterval[];
  onSessionClick: (session: WorkSession) => void;
  onSessionMove: (session: WorkSession, newStart: string, newEnd: string) => Promise<boolean>;
}

export function useDragToMove({
  trackRef,
  blockRef,
  session,
  startMins,
  endMins,
  leftPercent,
  rangeStartMin,
  rangeEndMin,
  siblings,
  onSessionClick,
  onSessionMove,
}: UseDragToMoveOptions) {
  const { showTooltip, hideTooltip } = useDragTooltip();
  const blockDuration = endMins - startMins;
  const movedRef = useRef(false);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault(); // prevent text-selection cursor during drag

      const moveStartX = event.clientX;
      const threshold = event.pointerType === "mouse" ? MOUSE_MOVE_THRESHOLD_PX : TOUCH_MOVE_THRESHOLD_PX;
      movedRef.current = false;
      let pendingStart = startMins;
      let pendingEnd = endMins;
      const block = blockRef.current;
      if (!block) return;

      function restoreOriginalPosition() {
        if (block) block.style.left = `${leftPercent}%`;
      }

      beginPointerDrag(block, event.pointerId, {
        onMove(moveEvent) {
          const deltaX = moveEvent.clientX - moveStartX;
          if (!movedRef.current && Math.abs(deltaX) < threshold) return;
          movedRef.current = true;

          const track = trackRef.current;
          if (!track || !block) return;
          const rect = track.getBoundingClientRect();
          const deltaMins = (deltaX / rect.width) * (rangeEndMin - rangeStartMin);
          let rawStart = Math.round(startMins + deltaMins);
          rawStart = Math.min(Math.max(rawStart, rangeStartMin), rangeEndMin - blockDuration);

          // Resolve against siblings on every move, not just at drop -- the
          // block visually can't overlap another session even mid-drag, so
          // there's nothing left to correct once the pointer comes up.
          const resolved = snapToNearestFreeSlot(rawStart, blockDuration, siblings, rangeStartMin, rangeEndMin);
          if (!resolved) return; // wedged with no room in this direction; hold the last valid spot

          pendingStart = resolved.start;
          pendingEnd = resolved.end;

          block.style.left = `${minutesToPercent(resolved.start, rangeStartMin, rangeEndMin)}%`;
          block.classList.add("timeline-block-dragging");
          showTooltip(
            `${formatTimeShort(minsToTimeStr(resolved.start))} – ${formatTimeShort(minsToTimeStr(resolved.end))}`,
            moveEvent.clientX,
            moveEvent.clientY
          );
        },

        async onEnd() {
          hideTooltip();
          block?.classList.remove("timeline-block-dragging");

          if (!movedRef.current) return; // handled as a plain click via onClick below

          const ok = await onSessionMove(session, minsToTimeStr(pendingStart), minsToTimeStr(pendingEnd));
          if (!ok && block) {
            // Revert visually since a failed move doesn't trigger a re-render.
            restoreOriginalPosition();
            block.classList.add("timeline-block-invalid");
            setTimeout(() => block.classList.remove("timeline-block-invalid"), 400);
          }
        },

        // Gesture reclaimed by the browser: drop the move entirely.
        onCancel() {
          hideTooltip();
          block?.classList.remove("timeline-block-dragging");
          restoreOriginalPosition();
          movedRef.current = false;
        },
      });
    },
    [
      trackRef,
      blockRef,
      session,
      startMins,
      endMins,
      blockDuration,
      leftPercent,
      rangeStartMin,
      rangeEndMin,
      siblings,
      onSessionMove,
      showTooltip,
      hideTooltip,
    ]
  );

  const onClick = useCallback(() => {
    if (movedRef.current) {
      movedRef.current = false; // consume: a drag shouldn't also open the edit modal
      return;
    }
    onSessionClick(session);
  }, [onSessionClick, session]);

  return { onPointerDown, onClick };
}
