import { useSettings } from "../contexts/SettingsContext";
import { formatDuration } from "../utils/dateUtils";
import { carryoverPercent, nominalTargetPercent, type SummaryState } from "../utils/weekSummary";
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
  requiredMinutes: number;
  state: SummaryState;
  label: string;
  fillPercent: number;
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
  requiredMinutes,
  state,
  label,
  fillPercent,
  correctionMinutes,
  onCorrectionChange,
  isRecording,
  recordingElapsedMinutes,
  onToggleRecording,
}: WeekHeaderProps) {
  const { settings } = useSettings();
  const carryoverMinutes = settings.weeklyTargetMinutes - requiredMinutes;
  const gaugeTooltip =
    requiredMinutes !== settings.weeklyTargetMinutes
      ? `${formatDuration(adjustedMinutes)} worked / ${formatDuration(requiredMinutes)} required (${formatDuration(
          settings.weeklyTargetMinutes
        )} target)`
      : `${formatDuration(adjustedMinutes)} worked / ${formatDuration(settings.weeklyTargetMinutes)} target`;

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
          <SummaryGauge
            state={state}
            fillPercent={fillPercent}
            nominalTargetPercent={nominalTargetPercent(settings.weeklyTargetMinutes)}
            carryoverMinutes={carryoverMinutes}
            carryoverPercent={carryoverPercent(carryoverMinutes, settings.weeklyTargetMinutes)}
            tooltip={gaugeTooltip}
          />
          <CorrectionInput value={correctionMinutes} onChange={onCorrectionChange} />
        </div>
      </div>
    </header>
  );
}
