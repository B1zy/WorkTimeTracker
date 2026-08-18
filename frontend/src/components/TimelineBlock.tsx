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
import { useDragToMove } from "../hooks/useDragToMove";
import { useDragToResize } from "../hooks/useDragToResize";

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

  const { onMouseDown, onClick } = useDragToMove({
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

  const { onResizeStartMouseDown, onResizeEndMouseDown } = useDragToResize({
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

  const entryTypeClass = ENTRY_TYPE_CLASS[session.entryType];
  const colorClass = entryTypeClass ?? LOCATION_CLASS[session.location] ?? "loc-other";
  const typeLabel = ENTRY_TYPE_LABEL[session.entryType] ?? session.entryType;
  const title = `${session.name} · ${typeLabel}${entryTypeClass ? "" : ` · ${LOCATION_LABEL[session.location] ?? session.location}`} · ${formatTimeShort(session.start)}–${formatTimeShort(session.end)} · ${formatDuration(durationMinutes(session.start, session.end))}`;

  return (
    <button
      ref={blockRef}
      type="button"
      className={`timeline-block ${colorClass}`}
      style={{ left: `${left}%`, width: `${width}%` }}
      title={title}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      <span
        className="timeline-resize-handle timeline-resize-handle-start"
        onMouseDown={onResizeStartMouseDown}
        aria-hidden="true"
      />
      <span className="block-name-row">
        <span className="block-name">{session.name}</span>
        <span className="block-time">{formatDuration(durationMinutes(session.start, session.end))}</span>
      </span>
      {session.description && <span className="block-desc">{session.description}</span>}
      <span
        className="timeline-resize-handle timeline-resize-handle-end"
        onMouseDown={onResizeEndMouseDown}
        aria-hidden="true"
      />
    </button>
  );
}
