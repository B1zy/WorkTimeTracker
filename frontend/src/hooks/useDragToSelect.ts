// Drag-to-select: creates a new session on empty track space.
// The ghost preview is mutated directly via its ref (not React state) so
// pointermove doesn't trigger a re-render on every pixel of movement.

import { useCallback, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { formatTimeShort } from "../utils/dateUtils";
import { minsToTimeStr, snapMinutesTo5 } from "../utils/timelineLayout";
import { useDragTooltip } from "./useDragTooltip";
import { beginPointerDrag } from "./pointerDrag";

export function useDragToSelect(
  trackRef: RefObject<HTMLDivElement | null>,
  ghostRef: RefObject<HTMLDivElement | null>,
  onTrackClick: (startTime: string, endTime: string | null) => void,
  rangeStartMin: number,
  rangeEndMin: number
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

      const dragStart = fractionFromEvent(event);
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
          const current = fractionFromEvent(moveEvent);
          const left = Math.min(dragStart, current);
          const width = Math.abs(current - dragStart);
          if (ghost) {
            ghost.style.left = `${left * 100}%`;
            ghost.style.width = `${width * 100}%`;
          }

          const startMins = minsFromFraction(left, moveEvent.ctrlKey);
          const endMins = minsFromFraction(left + width, moveEvent.ctrlKey);
          showTooltip(
            `${formatTimeShort(minsToTimeStr(startMins))} – ${formatTimeShort(minsToTimeStr(endMins))}`,
            moveEvent.clientX,
            moveEvent.clientY
          );
        },

        onEnd(upEvent) {
          hideGhost();

          const endFrac = fractionFromEvent(upEvent);
          const startFrac = Math.min(dragStart, endFrac);
          const stopFrac = Math.max(dragStart, endFrac);

          const startMins = minsFromFraction(startFrac, upEvent.ctrlKey);
          const endMins = minsFromFraction(stopFrac, upEvent.ctrlKey);

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
    [trackRef, ghostRef, fractionFromEvent, minsFromFraction, showTooltip, hideTooltip, onTrackClick]
  );

  return { onPointerDown };
}
