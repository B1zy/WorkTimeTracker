import type { WorkSession } from "../types/WorkSession";
import { durationMinutes, formatDayShort, formatDuration, formatWeekdayShort, toISODate } from "../utils/dateUtils";
import { DAY_TARGET_LABEL } from "../utils/weekSummary";
import { TimelineAxis } from "./TimelineAxis";
import { TimelineTrack } from "./TimelineTrack";

interface DayRowProps {
  date: Date;
  sessions: WorkSession[];
  onAddClick: (dateIso: string, dateObj: Date, startTime?: string | null, endTime?: string | null) => void;
  onSessionClick: (session: WorkSession) => void;
  onSessionMove: (session: WorkSession, newStart: string, newEnd: string) => Promise<boolean>;
  onRemoveAllClick: (dateIso: string) => void;
}

export function DayRow({
  date,
  sessions,
  onAddClick,
  onSessionClick,
  onSessionMove,
  onRemoveAllClick,
}: DayRowProps) {
  const iso = toISODate(date);
  const totalMinutes = sessions.reduce((sum, s) => sum + durationMinutes(s.start, s.end), 0);

  return (
    <div className="day-row">
      <div className="day-row-header">
        <div className="weekday">{formatWeekdayShort(date)}</div>
        <div className="date">{formatDayShort(date)}</div>
      </div>

      <div className="day-row-timeline">
        <TimelineAxis />
        <TimelineTrack
          sessions={sessions}
          onSessionClick={onSessionClick}
          onTrackClick={(startTime, endTime) => onAddClick(iso, date, startTime, endTime)}
          onSessionMove={onSessionMove}
        />
      </div>

      <div className="day-row-summary">
        <div className="day-total-group">
          <div className="day-total">{formatDuration(totalMinutes)}</div>
          <div className="day-target">/ {DAY_TARGET_LABEL}</div>
        </div>
        <div className="day-row-actions">
          <button type="button" className="add-btn" onClick={() => onAddClick(iso, date, null, null)}>
            + Add
          </button>
          <button
            type="button"
            className="remove-all-btn"
            title="Remove all entries for this day"
            onClick={() => onRemoveAllClick(iso)}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
