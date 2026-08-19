import type { CSSProperties } from "react";
import type { WorkSession } from "../types/WorkSession";
import { useSettings } from "../contexts/SettingsContext";
import { formatDayShort, formatDuration, formatWeekdayShort, toISODate } from "../utils/dateUtils";
import { sumCountedMinutes } from "../utils/entryTypeCounting";
import { workdayCount } from "../utils/workweek";
import { classifySummaryState, dayTargetLabel, dayTargetMinutes } from "../utils/weekSummary";
import { TimelineAxis } from "./TimelineAxis";
import { TimelineTrack } from "./TimelineTrack";

interface DayRowProps {
  date: Date;
  sessions: WorkSession[];
  index: number;
  isToday: boolean;
  nowMinutes: number;
  onAddClick: (dateIso: string, dateObj: Date, startTime?: string | null, endTime?: string | null) => void;
  onSessionClick: (session: WorkSession) => void;
  onSessionMove: (session: WorkSession, newStart: string, newEnd: string) => Promise<boolean>;
  onRemoveAllClick: (dateIso: string) => void;
}

export function DayRow({
  date,
  sessions,
  index,
  isToday,
  nowMinutes,
  onAddClick,
  onSessionClick,
  onSessionMove,
  onRemoveAllClick,
}: DayRowProps) {
  const { settings } = useSettings();
  const iso = toISODate(date);
  const activeDayCount = workdayCount(settings.workdays);
  const totalMinutes = sumCountedMinutes(sessions, settings.entryTypeCounting);
  const dayState = classifySummaryState(
    totalMinutes,
    dayTargetMinutes(settings.weeklyTargetMinutes, activeDayCount)
  );

  return (
    <div className={`day-row${isToday ? " is-today" : ""}`} style={{ "--row-index": index } as CSSProperties}>
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
          nowMinutes={isToday ? nowMinutes : null}
          onSessionClick={onSessionClick}
          onTrackClick={(startTime, endTime) => onAddClick(iso, date, startTime, endTime)}
          onSessionMove={onSessionMove}
        />
      </div>

      <div className="day-row-summary">
        <div className="day-total-group">
          <div className={`day-total state-${dayState}`}>{formatDuration(totalMinutes)}</div>
          <div className="day-target">/ {dayTargetLabel(settings.weeklyTargetMinutes, activeDayCount)}</div>
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
