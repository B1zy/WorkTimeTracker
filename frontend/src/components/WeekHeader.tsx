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

        {/* Console-lamp status indicator: a glowing dot + colored label. */}
        <span className={`status-indicator status-${state}`}>
          <span className="status-lamp" />
          <span className="status-label">{label}</span>
        </span>

        <div className="summary-meter">
          <SummaryGauge state={state} fillPercent={fillPercent} targetPercent={targetPercent} />
          <CorrectionInput value={correctionMinutes} onChange={onCorrectionChange} />
        </div>
      </div>
    </header>
  );
}
