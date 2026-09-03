import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { WorkSession } from "../types/WorkSession";
import { durationMinutes, formatDuration, formatTimeShort, timeStringToMinutes } from "../utils/dateUtils";
import {
  ENTRY_TYPE_CLASS,
  ENTRY_TYPE_LABEL,
  LOCATION_CLASS,
  LOCATION_LABEL,
  minutesToPercent,
  nearestLeftBoundary,
  nearestRightBoundary,
} from "../utils/timelineLayout";
import { useSettings } from "../contexts/SettingsContext";
import { useDragToMove } from "../hooks/useDragToMove";
import { useDragToResize } from "../hooks/useDragToResize";
import { useKeyboardAdjust } from "../hooks/useKeyboardAdjust";
import { SessionTooltip } from "./SessionTooltip";

// Hover delay before the tooltip appears -- kept at 0 (rather than removing
// the timer) so scheduleTooltip/hideTooltip's cancel-on-leave logic still
// applies: still fires via a real timeout, just on the next tick, instead of
// synchronously inside the mouseenter handler.
const TOOLTIP_DELAY_MS = 0;

interface TimelineBlockProps {
  session: WorkSession;
  allSessions: WorkSession[];
  trackRef: RefObject<HTMLDivElement | null>;
  rangeStartMin: number;
  rangeEndMin: number;
  onSessionClick: (session: WorkSession) => void;
  onSessionMove: (session: WorkSession, newStart: string, newEnd: string) => Promise<boolean>;
}

export function TimelineBlock({
  session,
  allSessions,
  trackRef,
  rangeStartMin,
  rangeEndMin,
  onSessionClick,
  onSessionMove,
}: TimelineBlockProps) {
  const { settings } = useSettings();
  const counting = settings.entryTypeCounting;
  const blockRef = useRef<HTMLButtonElement>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearHoverTimer() {
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }
  function scheduleTooltip() {
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => setIsTooltipVisible(true), TOOLTIP_DELAY_MS);
  }
  // Focus shows it immediately (no delay) -- a keyboard user already
  // deliberately navigated here, unlike a mouse pointer skimming past.
  function showTooltipNow() {
    clearHoverTimer();
    setIsTooltipVisible(true);
  }
  function hideTooltip() {
    clearHoverTimer();
    setIsTooltipVisible(false);
  }
  useEffect(() => clearHoverTimer, []);

  const startMins = timeStringToMinutes(session.start);
  const endMins = timeStringToMinutes(session.end);
  const left = minutesToPercent(startMins, rangeStartMin, rangeEndMin);
  const right = minutesToPercent(endMins, rangeStartMin, rangeEndMin);
  // Minimum width keeps very short sessions visible and clickable.
  const width = Math.max(right - left, 1);

  const siblingIntervals = allSessions
    .filter((s) => s.id !== session.id)
    .map((s) => ({ start: timeStringToMinutes(s.start), end: timeStringToMinutes(s.end) }));
  const leftBoundMins = nearestLeftBoundary(startMins, siblingIntervals, rangeStartMin);
  const rightBoundMins = nearestRightBoundary(endMins, siblingIntervals, rangeEndMin);

  const { onPointerDown: onMovePointerDown, onClick } = useDragToMove({
    trackRef,
    blockRef,
    session,
    startMins,
    endMins,
    leftPercent: left,
    rangeStartMin,
    rangeEndMin,
    siblings: siblingIntervals,
    onSessionClick,
    onSessionMove,
  });

  const { onResizeStartPointerDown: onResizeStart, onResizeEndPointerDown: onResizeEnd } = useDragToResize({
    trackRef,
    blockRef,
    session,
    startMins,
    endMins,
    leftBoundMins,
    rightBoundMins,
    rangeStartMin,
    rangeEndMin,
    onSessionResize: onSessionMove,
  });

  function handleResizeStart(event: ReactPointerEvent<HTMLSpanElement>) {
    hideTooltip();
    onResizeStart(event);
  }
  function handleResizeEnd(event: ReactPointerEvent<HTMLSpanElement>) {
    hideTooltip();
    onResizeEnd(event);
  }

  const { onKeyDown, onBlur: onAdjustBlur } = useKeyboardAdjust({
    blockRef,
    session,
    startMins,
    endMins,
    leftBoundMins,
    rightBoundMins,
    rangeStartMin,
    rangeEndMin,
    onSessionMove,
  });

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    // A drag (or the click it might turn out to be) shouldn't leave a stale
    // tooltip floating over wherever the block used to be.
    hideTooltip();
    onMovePointerDown(event);
  }

  function handleBlur() {
    onAdjustBlur();
    hideTooltip();
  }

  // Labels degrade by the session's actual duration, not by how wide it
  // happens to render -- a 55m lunch break should read the same whether the
  // visible timebar range is 8h or 24h. Full name+duration needs room for
  // both lines; duration-only still needs to fit a few centered characters;
  // anything shorter than that is too tight for any text at all.
  const totalMinutes = durationMinutes(session.start, session.end);
  const labelTier = totalMinutes >= 150 ? "full" : totalMinutes >= 80 ? "duration" : "bare";

  const entryTypeClass = ENTRY_TYPE_CLASS[session.entryType];
  const colorClass = entryTypeClass ?? LOCATION_CLASS[session.location] ?? "loc-other";
  const typeLabel = ENTRY_TYPE_LABEL[session.entryType] ?? session.entryType;
  // Make it visible on the timeline that an entry isn't contributing to the
  // day's total -- otherwise an ignored Appointment looks identical to a
  // counted one.
  const countingMode = counting[session.entryType];
  const countingClass =
    countingMode === "ignore" ? " is-not-counted" : countingMode === "subtract" ? " is-subtracted" : "";
  // An unnamed session shows its type instead -- on the block itself and in
  // this tooltip, where naming it a second time (name-less sessions would
  // otherwise duplicate the type label) would just be noise.
  const displayName = session.name.trim() || typeLabel;
  const title = [
    session.name.trim() || null,
    typeLabel,
    entryTypeClass ? null : (LOCATION_LABEL[session.location] ?? session.location),
    `${formatTimeShort(session.start)}–${formatTimeShort(session.end)}`,
    formatDuration(durationMinutes(session.start, session.end)),
  ]
    .filter(Boolean)
    .join(" · ");

  // A resize handle's pointerdown stops propagation so it doesn't also start
  // a move-drag, but the browser still fires a `click` on pointerup that
  // bubbles to the button's onClick regardless -- left unstopped, that opened
  // the edit modal with the pre-resize `session` prop (the async resize
  // hadn't landed yet), showing stale times. Stop it here too.
  function stopResizeHandleClick(event: ReactMouseEvent) {
    event.stopPropagation();
  }

  return (
    <>
      <button
        ref={blockRef}
        type="button"
        className={`timeline-block ${colorClass}${countingClass} label-${labelTier}`}
        style={{ left: `${left}%`, width: `${width}%` }}
        aria-label={title}
        aria-keyshortcuts="ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight Alt+ArrowLeft Alt+ArrowRight"
        onPointerDown={handlePointerDown}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onMouseEnter={scheduleTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltipNow}
        onBlur={handleBlur}
      >
        <span
          className="timeline-resize-handle timeline-resize-handle-start"
          onPointerDown={handleResizeStart}
          onClick={stopResizeHandleClick}
          aria-hidden="true"
        />
        {labelTier === "full" && (
          <>
            <span className="block-name-row">
              <span className="block-name">{displayName}</span>
              <span className="block-time">{formatDuration(totalMinutes)}</span>
            </span>
            {session.description && <span className="block-desc">{session.description}</span>}
          </>
        )}
        {labelTier === "duration" && <span className="block-duration-only">{formatDuration(totalMinutes)}</span>}
        <span
          className="timeline-resize-handle timeline-resize-handle-end"
          onPointerDown={handleResizeEnd}
          onClick={stopResizeHandleClick}
          aria-hidden="true"
        />
      </button>
      {isTooltipVisible && <SessionTooltip session={session} anchorRef={blockRef} />}
    </>
  );
}
