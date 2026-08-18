import { useRef } from "react";
import type { WorkSession } from "../types/WorkSession";
import { useDragToSelect } from "../hooks/useDragToSelect";
import { TimelineBlock } from "./TimelineBlock";

interface TimelineTrackProps {
  sessions: WorkSession[];
  rangeStartMin: number;
  rangeEndMin: number;
  onSessionClick: (session: WorkSession) => void;
  onTrackClick: (startTime: string, endTime: string | null) => void;
  onSessionMove: (session: WorkSession, newStart: string, newEnd: string) => Promise<boolean>;
}

export function TimelineTrack({
  sessions,
  rangeStartMin,
  rangeEndMin,
  onSessionClick,
  onTrackClick,
  onSessionMove,
}: TimelineTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);

  const { onMouseDown } = useDragToSelect(trackRef, ghostRef, onTrackClick, rangeStartMin, rangeEndMin);

  return (
    <div ref={trackRef} className="timeline-track" onMouseDown={onMouseDown}>
      {/* Ghost block shown while dragging to preview the selected range. */}
      <div ref={ghostRef} className="timeline-ghost" hidden />
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
