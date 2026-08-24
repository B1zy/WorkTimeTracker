import { useState, type CSSProperties } from "react";
import type { WorkSession } from "../types/WorkSession";
import { useSettings } from "../contexts/SettingsContext";
import { useWeather } from "../contexts/WeatherContext";
import { formatDayHeaderLabel, formatDayShort, formatDuration, formatWeekdayShort, toISODate } from "../utils/dateUtils";
import { sumCountedMinutes } from "../utils/entryTypeCounting";
import { workdayCount } from "../utils/workweek";
import { classifySummaryState, dayTargetLabel, dayTargetMinutes } from "../utils/weekSummary";
import { computeDayBreakCompliance } from "../utils/breakCompliance";
import { TimelineAxis } from "./TimelineAxis";
import { TimelineTrack } from "./TimelineTrack";
import { WeatherBadge } from "./WeatherBadge";

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
  onCopyClick: (dateIso: string) => void;
  onPasteClick: (dateIso: string) => void;
  hasClipboard: boolean;
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
  onCopyClick,
  onPasteClick,
  hasClipboard,
}: DayRowProps) {
  const { settings } = useSettings();
  const { weatherByDate } = useWeather();
  const iso = toISODate(date);
  // A day with existing entries needs a second click before Paste actually
  // overwrites them; an empty day has nothing to lose, so it pastes right
  // away. Reset by hasClipboard too, so a stale "Sure?" can't linger once
  // there's nothing left to paste.
  const [confirmingPaste, setConfirmingPaste] = useState(false);
  const isConfirmingPaste = confirmingPaste && hasClipboard;

  function handlePasteButtonClick() {
    if (sessions.length > 0 && !isConfirmingPaste) {
      setConfirmingPaste(true);
      return;
    }
    setConfirmingPaste(false);
    onPasteClick(iso);
  }

  const pasteLabel = !hasClipboard
    ? "Copy a day first"
    : isConfirmingPaste
      ? "Click again to overwrite this day's entries"
      : "Replace this day's entries with the copied ones";

  const activeDayCount = workdayCount(settings.workdays);
  const totalMinutes = sumCountedMinutes(sessions, settings.entryTypeCounting);
  const dayState = classifySummaryState(
    totalMinutes,
    dayTargetMinutes(settings.weeklyTargetMinutes, activeDayCount)
  );
  const breakCompliance = computeDayBreakCompliance(sessions);

  return (
    <div className={`day-row${isToday ? " is-today" : ""}`} style={{ "--row-index": index } as CSSProperties}>
      <div className="day-row-header">
        <div className="day-row-header-top">
          <div className="weekday">{formatWeekdayShort(date)}</div>
          <WeatherBadge day={weatherByDate[iso]} weekdayLabel={formatWeekdayShort(date)} dateLabel={formatDayHeaderLabel(date)} />
        </div>
        <div className="date">{formatDayShort(date)}</div>
      </div>

      <div className="day-row-timeline">
        <TimelineAxis rangeStartMin={settings.timelineStartMin} rangeEndMin={settings.timelineEndMin} />
        <TimelineTrack
          sessions={sessions}
          rangeStartMin={settings.timelineStartMin}
          rangeEndMin={settings.timelineEndMin}
          nowMinutes={isToday ? nowMinutes : null}
          breakCompliance={breakCompliance}
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
        <div className="day-row-actions">
          <button
            type="button"
            className="copy-btn"
            title="Copy this day's entries"
            onClick={() => onCopyClick(iso)}
          >
            Copy
          </button>
          <button
            type="button"
            className={`paste-btn${isConfirmingPaste ? " is-confirming" : ""}`}
            title={pasteLabel}
            disabled={!hasClipboard}
            onClick={handlePasteButtonClick}
            onBlur={() => setConfirmingPaste(false)}
          >
            {isConfirmingPaste ? "Sure?" : "Paste"}
          </button>
        </div>
      </div>
    </div>
  );
}
