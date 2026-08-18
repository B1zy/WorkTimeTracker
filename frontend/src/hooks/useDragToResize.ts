// Drag-to-resize: adjusts one edge (start or end) of an existing session
// block, keeping the other edge fixed. Clamped in real time against the
// nearest sibling session so it can never be dragged into an overlap.

import { useCallback, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { WorkSession } from "../types/WorkSession";
import { formatTimeShort } from "../utils/dateUtils";
import { minsToTimeStr, minutesToPercent, snapMinutesTo5 } from "../utils/timelineLayout";
import { useDragTooltip } from "./useDragTooltip";
import { beginPointerDrag } from "./pointerDrag";

const MIN_DURATION_MIN = 5;

interface UseDragToResizeOptions {
  trackRef: RefObject<HTMLDivElement | null>;
  blockRef: RefObject<HTMLButtonElement | null>;
  session: WorkSession;
  startMins: number;
  endMins: number;
  leftBoundMins: number;
  rightBoundMins: number;
  rangeStartMin: number;
  rangeEndMin: number;
  onSessionResize: (session: WorkSession, newStart: string, newEnd: string) => Promise<boolean>;
}

export function useDragToResize({
  trackRef,
  blockRef,
  session,
  startMins,
  endMins,
  leftBoundMins,
  rightBoundMins,
  rangeStartMin,
  rangeEndMin,
  onSessionResize,
}: UseDragToResizeOptions) {
  const { showTooltip, hideTooltip } = useDragTooltip();

  const makeHandler = useCallback(
    (edge: "start" | "end") => (event: ReactPointerEvent<HTMLSpanElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation(); // don't also trigger the block's own move/click handling

      let pendingStart = startMins;
      let pendingEnd = endMins;
      let moved = false;
      const block = blockRef.current;
      const handle = event.currentTarget;
      if (!block) return;

      function applyGeometry(start: number, end: number) {
        if (!block) return;
        const left = minutesToPercent(start, rangeStartMin, rangeEndMin);
        const right = minutesToPercent(end, rangeStartMin, rangeEndMin);
        block.style.left = `${left}%`;
        block.style.width = `${Math.max(right - left, 1)}%`;
      }

      beginPointerDrag(handle, event.pointerId, {
        onMove(moveEvent) {
          const track = trackRef.current;
          if (!track || !block) return;
          moved = true;

          const rect = track.getBoundingClientRect();
          const pointerMins =
            ((moveEvent.clientX - rect.left) / rect.width) * (rangeEndMin - rangeStartMin) + rangeStartMin;
          const snapped = snapMinutesTo5(pointerMins);

          if (edge === "start") {
            pendingStart = Math.min(Math.max(snapped, leftBoundMins), endMins - MIN_DURATION_MIN);
          } else {
            pendingEnd = Math.max(Math.min(snapped, rightBoundMins), startMins + MIN_DURATION_MIN);
          }

          applyGeometry(pendingStart, pendingEnd);
          block.classList.add("timeline-block-dragging");
          showTooltip(
            edge === "start"
              ? formatTimeShort(minsToTimeStr(pendingStart))
              : formatTimeShort(minsToTimeStr(pendingEnd)),
            moveEvent.clientX,
            moveEvent.clientY
          );
        },

        async onEnd() {
          hideTooltip();
          block?.classList.remove("timeline-block-dragging");

          if (!moved) return;

          const ok = await onSessionResize(session, minsToTimeStr(pendingStart), minsToTimeStr(pendingEnd));
          if (!ok && block) {
            applyGeometry(startMins, endMins);
            block.classList.add("timeline-block-invalid");
            setTimeout(() => block.classList.remove("timeline-block-invalid"), 400);
          }
        },

        onCancel() {
          hideTooltip();
          block?.classList.remove("timeline-block-dragging");
          applyGeometry(startMins, endMins);
        },
      });
    },
    [
      trackRef,
      blockRef,
      session,
      startMins,
      endMins,
      leftBoundMins,
      rightBoundMins,
      rangeStartMin,
      rangeEndMin,
      onSessionResize,
      showTooltip,
      hideTooltip,
    ]
  );

  return {
    onResizeStartPointerDown: makeHandler("start"),
    onResizeEndPointerDown: makeHandler("end"),
  };
}
