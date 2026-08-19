// Drag-to-select: creates a new session on empty track space.
// The ghost preview is mutated directly via its ref (not React state) so
// pointermove doesn't trigger a re-render on every pixel of movement.

import { useCallback, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { formatTimeShort } from "../utils/dateUtils";
import {
  minsToTimeStr,
  nearestLeftBoundary,
  nearestRightBoundary,
  snapMinutesTo5,
  type MinuteInterval,
} from "../utils/timelineLayout";
import { useDragTooltip } from "./useDragTooltip";
import { beginPointerDrag } from "./pointerDrag";

export function useDragToSelect(
  trackRef: RefObject<HTMLDivElement | null>,
  ghostRef: RefObject<HTMLDivElement | null>,
  onTrackClick: (startTime: string, endTime: string | null) => void,
  rangeStartMin: number,
  rangeEndMin: number,
  // Existing sessions for the day, as minute intervals -- the drag is
  // clamped to whichever gap between them the pointer went down in, so
  // dragging "through" a neighbor stops at its edge instead of creating an
  // overlap. Makes inserting e.g. a lunch break between two Working blocks a
  // single quick drag instead of a pixel-precise one.
  siblings: MinuteInterval[]
) {
  const { showTooltip, hideTooltip } = useDragTooltip();

  const fractionFromEvent = useCallback(
    (event: PointerEvent | ReactPointerEvent<HTMLDivElement>): number => {
      const track = trackRef.current;
      if (!track) return 0;
      const rect = track.getBoundingClientRect();
      return Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    },
    [trackRef]
  );

  const minsFromFraction = useCallback(
    (fraction: number, snap: boolean): number => {
      const raw = fraction * (rangeEndMin - rangeStartMin) + rangeStartMin;
      return snap ? snapMinutesTo5(raw) : Math.round(raw);
    },
    [rangeStartMin, rangeEndMin]
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      if (event.target !== trackRef.current) return; // ignore session block presses
      event.preventDefault(); // prevent text-selection cursor during drag

      const track = trackRef.current;
      if (!track) return;

      let dragStart = fractionFromEvent(event);
      let dragStartMins = minsFromFraction(dragStart, false);

      // The block itself covers only the middle of the track's height
      // (top/bottom 5px are its move-drag hit target, not the block), so a
      // press can land on the track element while still falling inside an
      // existing session's time span. Snap the anchor to that session's
      // nearer edge instead of starting the drag from inside it -- the same
      // "snap to the nearest edge" rule an overlapping move already gets.
      const containing = siblings.find((s) => s.start <= dragStartMins && dragStartMins < s.end);
      if (containing) {
        dragStartMins =
          dragStartMins - containing.start <= containing.end - dragStartMins ? containing.start : containing.end;
        dragStart = (dragStartMins - rangeStartMin) / (rangeEndMin - rangeStartMin);
      }

      // The free gap the anchor point fell in -- empty track everywhere
      // (rangeStartMin/rangeEndMin) if there are no siblings that day.
      const gapStartMin = nearestLeftBoundary(dragStartMins, siblings, rangeStartMin);
      const gapEndMin = nearestRightBoundary(dragStartMins, siblings, rangeEndMin);
      const gapStartFrac = (gapStartMin - rangeStartMin) / (rangeEndMin - rangeStartMin);
      const gapEndFrac = (gapEndMin - rangeStartMin) / (rangeEndMin - rangeStartMin);
      const clampFrac = (fraction: number) => Math.max(gapStartFrac, Math.min(gapEndFrac, fraction));
      const clampMins = (mins: number) => Math.max(gapStartMin, Math.min(gapEndMin, mins));

      const ghost = ghostRef.current;
      if (ghost) {
        ghost.hidden = false;
        ghost.style.left = `${dragStart * 100}%`;
        ghost.style.width = "0%";
      }

      function hideGhost() {
        if (ghost) ghost.hidden = true;
        hideTooltip();
      }

      beginPointerDrag(track, event.pointerId, {
        onMove(moveEvent) {
          const current = clampFrac(fractionFromEvent(moveEvent));
          const left = Math.min(dragStart, current);
          const width = Math.abs(current - dragStart);
          if (ghost) {
            ghost.style.left = `${left * 100}%`;
            ghost.style.width = `${width * 100}%`;
          }

          const startMins = clampMins(minsFromFraction(left, moveEvent.ctrlKey));
          const endMins = clampMins(minsFromFraction(left + width, moveEvent.ctrlKey));
          showTooltip(
            `${formatTimeShort(minsToTimeStr(startMins))} – ${formatTimeShort(minsToTimeStr(endMins))}`,
            moveEvent.clientX,
            moveEvent.clientY
          );
        },

        onEnd(upEvent) {
          hideGhost();

          const endFrac = clampFrac(fractionFromEvent(upEvent));
          const startFrac = Math.min(dragStart, endFrac);
          const stopFrac = Math.max(dragStart, endFrac);

          const startMins = clampMins(minsFromFraction(startFrac, upEvent.ctrlKey));
          const endMins = clampMins(minsFromFraction(stopFrac, upEvent.ctrlKey));

          // A drag shorter than 5 minutes is treated as a plain click: only the
          // start time is pre-filled and the modal calculates end = start + 1h.
          if (endMins - startMins < 5) {
            onTrackClick(minsToTimeStr(startMins), null);
          } else {
            onTrackClick(minsToTimeStr(startMins), minsToTimeStr(endMins));
          }
        },

        onCancel: hideGhost,
      });
    },
    [trackRef, ghostRef, fractionFromEvent, minsFromFraction, showTooltip, hideTooltip, onTrackClick, siblings, rangeStartMin, rangeEndMin]
  );

  return { onPointerDown };
}
