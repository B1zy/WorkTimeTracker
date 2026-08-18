import { useRef, type RefObject } from "react";
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

  const { onPointerDown, onClick } = useDragToMove({
    trackRef,
    blockRef,
    session,
    startMins,
    endMins,
    leftPercent: left,
    rangeStartMin,
    rangeEndMin,
    onSessionClick,
    onSessionMove,
  });

  const { onResizeStartPointerDown, onResizeEndPointerDown } = useDragToResize({
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

  const { onKeyDown, onBlur } = useKeyboardAdjust({
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

  const entryTypeClass = ENTRY_TYPE_CLASS[session.entryType];
  const colorClass = entryTypeClass ?? LOCATION_CLASS[session.location] ?? "loc-other";
  const typeLabel = ENTRY_TYPE_LABEL[session.entryType] ?? session.entryType;
  // Make it visible on the timeline that an entry isn't contributing to the
  // day's total -- otherwise an ignored Appointment looks identical to a
  // counted one.
  const countingMode = counting[session.entryType];
  const countingClass =
    countingMode === "ignore" ? " is-not-counted" : countingMode === "subtract" ? " is-subtracted" : "";
  const title = `${session.name} · ${typeLabel}${entryTypeClass ? "" : ` · ${LOCATION_LABEL[session.location] ?? session.location}`} · ${formatTimeShort(session.start)}–${formatTimeShort(session.end)} · ${formatDuration(durationMinutes(session.start, session.end))}`;

  return (
    <button
      ref={blockRef}
      type="button"
      className={`timeline-block ${colorClass}${countingClass}`}
      style={{ left: `${left}%`, width: `${width}%` }}
      title={title}
      aria-label={title}
      aria-keyshortcuts="ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight Alt+ArrowLeft Alt+ArrowRight"
      onPointerDown={onPointerDown}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <span
        className="timeline-resize-handle timeline-resize-handle-start"
        onPointerDown={onResizeStartPointerDown}
        aria-hidden="true"
      />
      <span className="block-name-row">
        <span className="block-name">{session.name}</span>
        <span className="block-time">{formatDuration(durationMinutes(session.start, session.end))}</span>
      </span>
      {session.description && <span className="block-desc">{session.description}</span>}
      <span
        className="timeline-resize-handle timeline-resize-handle-end"
        onPointerDown={onResizeEndPointerDown}
        aria-hidden="true"
      />
    </button>
  );
}
