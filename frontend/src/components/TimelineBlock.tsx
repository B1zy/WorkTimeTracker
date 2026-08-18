import { useRef, type RefObject } from "react";
import type { WorkSession } from "../types/WorkSession";
import { durationMinutes, formatDuration, formatTimeShort, timeStringToMinutes } from "../utils/dateUtils";
import { LOCATION_CLASS, LOCATION_LABEL, minutesToPercent } from "../utils/timelineLayout";
import { useDragToMove } from "../hooks/useDragToMove";

interface TimelineBlockProps {
  session: WorkSession;
  trackRef: RefObject<HTMLDivElement | null>;
  onSessionClick: (session: WorkSession) => void;
  onSessionMove: (session: WorkSession, newStart: string, newEnd: string) => Promise<boolean>;
}

export function TimelineBlock({ session, trackRef, onSessionClick, onSessionMove }: TimelineBlockProps) {
  const blockRef = useRef<HTMLButtonElement>(null);
  const startMins = timeStringToMinutes(session.start);
  const endMins = timeStringToMinutes(session.end);
  const left = minutesToPercent(startMins);
  const right = minutesToPercent(endMins);
  // Minimum width keeps very short sessions visible and clickable.
  const width = Math.max(right - left, 1);

  const { onMouseDown, onClick } = useDragToMove({
    trackRef,
    blockRef,
    session,
    startMins,
    endMins,
    leftPercent: left,
    onSessionClick,
    onSessionMove,
  });

  const title = `${session.name} · ${LOCATION_LABEL[session.location] ?? session.location} · ${formatTimeShort(session.start)}–${formatTimeShort(session.end)} · ${formatDuration(durationMinutes(session.start, session.end))}`;

  return (
    <button
      ref={blockRef}
      type="button"
      className={`timeline-block ${LOCATION_CLASS[session.location] ?? "loc-other"}`}
      style={{ left: `${left}%`, width: `${width}%` }}
      title={title}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      <span className="block-name">{session.name}</span>
      {session.description && <span className="block-desc">{session.description}</span>}
    </button>
  );
}
