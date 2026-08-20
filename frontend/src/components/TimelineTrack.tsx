import { useMemo, useRef } from "react";
import type { WorkSession } from "../types/WorkSession";
import { useDragToSelect } from "../hooks/useDragToSelect";
import { useTimelineHover } from "../hooks/useTimelineHover";
import { timeStringToMinutes } from "../utils/dateUtils";
import { minutesToPercent } from "../utils/timelineLayout";
import { TimelineBlock } from "./TimelineBlock";

interface TimelineTrackProps {
  sessions: WorkSession[];
  rangeStartMin: number;
  rangeEndMin: number;
  // Minutes-since-midnight for today's live position, or null for any day
  // that isn't today -- only today's row ever draws the line.
  nowMinutes?: number | null;
  onSessionClick: (session: WorkSession) => void;
  onTrackClick: (startTime: string, endTime: string | null) => void;
  onSessionMove: (session: WorkSession, newStart: string, newEnd: string) => Promise<boolean>;
}

export function TimelineTrack({
  sessions,
  rangeStartMin,
  rangeEndMin,
  nowMinutes,
  onSessionClick,
  onTrackClick,
  onSessionMove,
}: TimelineTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const hoverLineRef = useRef<HTMLDivElement>(null);

  const sessionIntervals = useMemo(
    () => sessions.map((s) => ({ start: timeStringToMinutes(s.start), end: timeStringToMinutes(s.end) })),
    [sessions]
  );

  const { onPointerDown } = useDragToSelect(
    trackRef,
    ghostRef,
    onTrackClick,
    rangeStartMin,
    rangeEndMin,
    sessionIntervals
  );

  const {
    onPointerDownCapture: onHoverPointerDownCapture,
    onPointerMove: onHoverPointerMove,
    onPointerLeave: onHoverPointerLeave,
  } = useTimelineHover(trackRef, hoverLineRef, rangeStartMin, rangeEndMin);

  // Hidden rather than clamped to the edge when "now" falls outside the
  // visible timebar range (e.g. a Timebar range setting of 8-18h, checked
  // at 20:00) -- pinning it to the edge would misleadingly suggest "now" is
  // right at that boundary.
  const showNowLine = nowMinutes != null && nowMinutes >= rangeStartMin && nowMinutes <= rangeEndMin;

  return (
    <div
      ref={trackRef}
      className="timeline-track"
      onPointerDown={onPointerDown}
      onPointerDownCapture={onHoverPointerDownCapture}
      onPointerMove={onHoverPointerMove}
      onPointerLeave={onHoverPointerLeave}
    >
      {/* Ghost block shown while dragging to preview the selected range. */}
      <div ref={ghostRef} className="timeline-ghost" hidden />
      {/* Hover preview: a thin guide line at the cursor's time, paired with
          the floating time-label pill (see useTimelineHover). */}
      <div ref={hoverLineRef} className="timeline-hover-line" hidden aria-hidden="true" />
      {showNowLine && (
        <div
          className="timeline-now-line"
          style={{ left: `${minutesToPercent(nowMinutes!, rangeStartMin, rangeEndMin)}%` }}
          aria-hidden="true"
        />
      )}
      {sessions.map((session) => (
        <TimelineBlock
          key={session.id}
          session={session}
          allSessions={sessions}
          trackRef={trackRef}
          rangeStartMin={rangeStartMin}
          rangeEndMin={rangeEndMin}
          onSessionClick={onSessionClick}
          onSessionMove={onSessionMove}
        />
      ))}
    </div>
  );
}
