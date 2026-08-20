import { useSettings } from "../contexts/SettingsContext";
import { formatDuration } from "../utils/dateUtils";
import type { SummaryState } from "../utils/weekSummary";
import { WeekNav } from "./WeekNav";
import { SummaryGauge } from "./SummaryGauge";
import { CorrectionInput } from "./CorrectionInput";

interface WeekHeaderProps {
  currentMonday: Date;
  weekRangeLabel: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onSelectWeek: (monday: Date) => void;
  adjustedMinutes: number;
  state: SummaryState;
  label: string;
  fillPercent: number;
  targetPercent: number;
  correctionMinutes: number;
  onCorrectionChange: (value: number) => void;
  isRecording: boolean;
  recordingElapsedMinutes: number;
  onToggleRecording: () => void;
}

export function WeekHeader({
  currentMonday,
  weekRangeLabel,
  onPrevWeek,
  onNextWeek,
  onSelectWeek,
  adjustedMinutes,
  state,
  label,
  fillPercent,
  targetPercent,
  correctionMinutes,
  onCorrectionChange,
  isRecording,
  recordingElapsedMinutes,
  onToggleRecording,
}: WeekHeaderProps) {
  const { settings } = useSettings();

  return (
    <header className="week-header">
      <WeekNav
        label={weekRangeLabel}
        currentMonday={currentMonday}
        onPrev={onPrevWeek}
        onNext={onNextWeek}
        onSelectWeek={onSelectWeek}
      />

      <div className="week-summary">
        <div className="summary-hours">
          <span className="summary-total">{formatDuration(adjustedMinutes)}</span>
          <span className="summary-target">/ {formatDuration(settings.weeklyTargetMinutes)} target</span>
        </div>

        {/* Console-lamp status indicator, doubling as the clock-in/out
            control: click to start recording the current time, click again
            to stop and save the elapsed span as a Working session. */}
        <button
          type="button"
          className={`status-indicator status-${isRecording ? "recording" : state}`}
          onClick={onToggleRecording}
          title={isRecording ? "Stop recording and save as a work session" : "Start recording the current time"}
        >
          <span className="status-lamp" />
          <span className="status-label">{isRecording ? `Recording · ${formatDuration(recordingElapsedMinutes)}` : label}</span>
        </button>

        <div className="summary-meter">
          <SummaryGauge state={state} fillPercent={fillPercent} targetPercent={targetPercent} />
          <CorrectionInput value={correctionMinutes} onChange={onCorrectionChange} />
        </div>
      </div>
    </header>
  );
}
