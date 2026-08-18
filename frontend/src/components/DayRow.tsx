import type { WorkSession } from "../types/WorkSession";
import { useSettings } from "../contexts/SettingsContext";
import { durationMinutes, formatDayShort, formatDuration, formatWeekdayShort, toISODate } from "../utils/dateUtils";
import { classifySummaryState, dayTargetLabel, dayTargetMinutes } from "../utils/weekSummary";
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
  const { settings } = useSettings();
  const iso = toISODate(date);
  const totalMinutes = sessions.reduce((sum, s) => sum + durationMinutes(s.start, s.end), 0);
  const dayState = classifySummaryState(totalMinutes, dayTargetMinutes(settings.weeklyTargetMinutes));

  return (
    <div className="day-row">
      <div className="day-row-header">
        <div className="weekday">{formatWeekdayShort(date)}</div>
        <div className="date">{formatDayShort(date)}</div>
      </div>

      <div className="day-row-timeline">
        <TimelineAxis rangeStartMin={settings.timelineStartMin} rangeEndMin={settings.timelineEndMin} />
        <TimelineTrack
          sessions={sessions}
          rangeStartMin={settings.timelineStartMin}
          rangeEndMin={settings.timelineEndMin}
          onSessionClick={onSessionClick}
          onTrackClick={(startTime, endTime) => onAddClick(iso, date, startTime, endTime)}
          onSessionMove={onSessionMove}
        />
      </div>

      <div className="day-row-summary">
        <div className="day-total-group">
          <div className={`day-total state-${dayState}`}>{formatDuration(totalMinutes)}</div>
          <div className="day-target">/ {dayTargetLabel(settings.weeklyTargetMinutes)}</div>
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
