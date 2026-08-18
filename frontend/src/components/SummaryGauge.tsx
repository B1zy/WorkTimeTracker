import type { SummaryState } from "../utils/weekSummary";

interface SummaryGaugeProps {
  state: SummaryState;
  fillPercent: number;
  targetPercent: number;
}

// Gauge meter: a tick-marked scale with a triangular needle at the target,
// standing in for a plain progress bar.
export function SummaryGauge({ state, fillPercent, targetPercent }: SummaryGaugeProps) {
  return (
    <div className="summary-bar-wrapper">
      <div className="summary-bar-track">
        <div className={`summary-bar-fill state-${state}`} style={{ width: `${fillPercent}%` }} />
      </div>
      {/* Sibling of .summary-bar-track (not nested) so the needle can extend
          above the track without being clipped by the track's overflow:hidden. */}
      <div className="summary-bar-target-marker" style={{ left: `${targetPercent}%` }} />
    </div>
  );
}
