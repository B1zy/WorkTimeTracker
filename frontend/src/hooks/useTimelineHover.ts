// Hover preview: a thin vertical guide line across the track plus a small
// floating time label (the same singleton pill useDragToSelect already uses
// for its start-end preview) that follows the cursor, showing what time a
// given point on the timebar corresponds to.
//
// Deliberately gated on "is a button currently pressed" rather than trying
// to coordinate directly with useDragToSelect/useDragToMove/useDragToResize:
// a capture-phase pointerdown listener on the track catches a press
// anywhere in its subtree (an empty stretch of track, a session block, a
// resize handle) before any of those hooks' own bubble-phase handlers run,
// so the guide/tooltip disappear immediately and simply don't reappear
// until the pointer is released and moved again -- no need for those hooks
// to know this exists.

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { formatTimeShort } from "../utils/dateUtils";
import { minsToTimeStr } from "../utils/timelineLayout";
import { useDragTooltip } from "./useDragTooltip";

export function useTimelineHover(
  trackRef: RefObject<HTMLDivElement | null>,
  lineRef: RefObject<HTMLDivElement | null>,
  rangeStartMin: number,
  rangeEndMin: number
) {
  const { showTooltip, hideTooltip } = useDragTooltip();
  const isPressedRef = useRef(false);

  const hide = useCallback(() => {
    const line = lineRef.current;
    if (line) line.hidden = true;
    hideTooltip();
  }, [lineRef, hideTooltip]);

  // Hide (rather than leave stuck) if this row unmounts mid-hover -- e.g.
  // the week is navigated away via a button/keyboard while the mouse never
  // actually left the track.
  useEffect(() => hide, [hide]);

  useEffect(() => {
    function handlePointerUp() {
      isPressedRef.current = false;
    }
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, []);

  const onPointerDownCapture = useCallback(() => {
    isPressedRef.current = true;
    hide();
  }, [hide]);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      // Touch has no real "hovering" -- a touch pointermove only happens
      // while the finger is already down, which the press-gate below would
      // catch anyway, but skip it outright rather than relying on timing.
      if (isPressedRef.current || event.pointerType !== "mouse") return;

      // A session block already has its own richer hover tooltip (name,
      // type, exact start-end, duration) -- adding this one too just
      // crowded the same corner of the screen with a redundant single time.
      if (event.target instanceof Element && event.target.closest(".timeline-block")) {
        hide();
        return;
      }

      const track = trackRef.current;
      const line = lineRef.current;
      if (!track || !line) return;

      const rect = track.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const mins = Math.round(fraction * (rangeEndMin - rangeStartMin) + rangeStartMin);

      line.hidden = false;
      line.style.left = `${fraction * 100}%`;
      showTooltip(formatTimeShort(minsToTimeStr(mins)), event.clientX, event.clientY);
    },
    [trackRef, lineRef, rangeStartMin, rangeEndMin, showTooltip, hide]
  );

  const onPointerLeave = useCallback(() => hide(), [hide]);

  return { onPointerDownCapture, onPointerMove, onPointerLeave };
}
