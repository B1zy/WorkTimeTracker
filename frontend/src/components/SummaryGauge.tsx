import type { SummaryState } from "../utils/weekSummary";
import { formatSignedDuration } from "../utils/dateUtils";

interface SummaryGaugeProps {
  state: SummaryState;
  fillPercent: number;
  nominalTargetPercent: number;
  carryoverMinutes: number;
  carryoverPercent: number;
  tooltip?: string;
}

// Gauge meter: a tick-marked scale with a triangular needle fixed at the
// plain "42h" mark, standing in for a plain progress bar. The exact hours
// (worked vs. required) live in `tooltip` rather than as visible text -- the
// fill and needle already carry that at a glance, so the numbers are a
// hover-away detail instead of competing with the bar for width.
//
// A banked carryover is drawn as a second segment attached directly to the
// fill, rather than a number reported separately from the bar it affects:
//   - surplus (ahead) -- a credit segment picks up right where the real fill
//     ends and reaches toward the needle, capped there. As the real fill
//     grows the gap it has to cover shrinks, so the credit segment shrinks
//     with it and vanishes once the fill reaches the needle on its own.
//   - deficit (behind) -- there's no progress to attach a credit to, so
//     instead the needle's *required* extra hours are shown as a debt
//     segment stretching out past the fixed 42h mark; it clears once the
//     fill actually reaches that extended point.
export function SummaryGauge({
  state,
  fillPercent,
  nominalTargetPercent,
  carryoverMinutes,
  carryoverPercent,
  tooltip,
}: SummaryGaugeProps) {
  const isSurplus = carryoverMinutes > 0;
  const isDeficit = carryoverMinutes < 0;

  const creditEnd = Math.min(fillPercent + carryoverPercent, nominalTargetPercent);
  const showCredit = isSurplus && fillPercent < nominalTargetPercent;

  const debtEnd = Math.min(nominalTargetPercent + carryoverPercent, 100);
  const showDebt = isDeficit && fillPercent < debtEnd;

  return (
    <div className="summary-bar-wrapper" title={tooltip}>
      <div className="summary-bar-track">
        <div className={`summary-bar-fill state-${state}`} style={{ width: `${fillPercent}%` }} />
        {showCredit && (
          <div
            className="summary-bar-carryover-segment is-surplus"
            style={{ left: `${fillPercent}%`, width: `${creditEnd - fillPercent}%` }}
          />
        )}
        {showDebt && (
          <div
            className="summary-bar-carryover-segment is-deficit"
            style={{ left: `${nominalTargetPercent}%`, width: `${debtEnd - nominalTargetPercent}%` }}
          />
        )}
      </div>
      {/* Sibling of .summary-bar-track (not nested) so the needle can extend
          above the track without being clipped by the track's overflow:hidden. */}
      <div className="summary-bar-target-marker" style={{ left: `${nominalTargetPercent}%` }} />
      {(showCredit || showDebt) && (
        <div
          className={`summary-bar-carryover-label ${isSurplus ? "is-surplus" : "is-deficit"}`}
          style={{ left: `${showCredit ? (fillPercent + creditEnd) / 2 : (nominalTargetPercent + debtEnd) / 2}%` }}
        >
          {formatSignedDuration(carryoverMinutes)}
        </div>
      )}
    </div>
  );
}
