// Drag-to-select: creates a new session on empty track space.
// The ghost preview is mutated directly via its ref (not React state) so
// mousemove doesn't trigger a re-render on every pixel of movement.

import { useCallback, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import { formatTimeShort } from "../utils/dateUtils";
import { DAY_RANGE_MIN, DAY_START_MIN, minsToTimeStr, snapMinutesTo5 } from "../utils/timelineLayout";
import { useDragTooltip } from "./useDragTooltip";

export function useDragToSelect(
  trackRef: RefObject<HTMLDivElement | null>,
  ghostRef: RefObject<HTMLDivElement | null>,
  onTrackClick: (startTime: string, endTime: string | null) => void
) {
  const { showTooltip, hideTooltip } = useDragTooltip();

  const fractionFromEvent = useCallback(
    (event: MouseEvent): number => {
      const track = trackRef.current;
      if (!track) return 0;
      const rect = track.getBoundingClientRect();
      return Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    },
    [trackRef]
  );

  const minsFromFraction = useCallback((fraction: number, snap: boolean): number => {
    const raw = fraction * DAY_RANGE_MIN + DAY_START_MIN;
    return snap ? snapMinutesTo5(raw) : Math.round(raw);
  }, []);

  const onMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.target !== trackRef.current) return; // ignore session block clicks
      event.preventDefault(); // prevent text-selection cursor during drag

      const dragStart = fractionFromEvent(event.nativeEvent);
      const ghost = ghostRef.current;
      if (ghost) {
        ghost.hidden = false;
        ghost.style.left = `${dragStart * 100}%`;
        ghost.style.width = "0%";
      }

      function handleMouseMove(moveEvent: MouseEvent) {
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
      }

      function handleMouseUp(upEvent: MouseEvent) {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        if (ghost) ghost.hidden = true;
        hideTooltip();

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
      }

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [trackRef, ghostRef, fractionFromEvent, minsFromFraction, showTooltip, hideTooltip, onTrackClick]
  );

  return { onMouseDown };
}
