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
//
// Both segments (and the label) are *always* mounted, collapsed to width 0
// / opacity 0 when not applicable, rather than conditionally rendered --
// mounting fresh with `left`/`width` already at their final value skips the
// CSS transition entirely (nothing to transition *from*), which is exactly
// why the segment used to just pop into place instead of sliding in attached
// to the fill's leading edge.
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
  const creditWidth = showCredit ? creditEnd - fillPercent : 0;

  const debtEnd = Math.min(nominalTargetPercent + carryoverPercent, 100);
  const showDebt = isDeficit && fillPercent < debtEnd;
  const debtWidth = showDebt ? debtEnd - nominalTargetPercent : 0;

  const labelVisible = showCredit || showDebt;
  const labelLeft = isSurplus ? fillPercent + creditWidth / 2 : nominalTargetPercent + debtWidth / 2;

  return (
    <div className="summary-bar-wrapper" title={tooltip}>
      <div className="summary-bar-track">
        <div className={`summary-bar-fill state-${state}`} style={{ width: `${fillPercent}%` }} />
        {/* left always tracks fillPercent, even at width 0, so the moment it
            does need to show it's already riding the fill's leading edge
            instead of jumping there. */}
        <div
          className="summary-bar-carryover-segment is-surplus"
          style={{ left: `${fillPercent}%`, width: `${creditWidth}%` }}
        />
        <div
          className="summary-bar-carryover-segment is-deficit"
          style={{ left: `${nominalTargetPercent}%`, width: `${debtWidth}%` }}
        />
      </div>
      {/* Sibling of .summary-bar-track (not nested) so the needle can extend
          above the track without being clipped by the track's overflow:hidden. */}
      <div className="summary-bar-target-marker" style={{ left: `${nominalTargetPercent}%` }} />
      <div
        className={`summary-bar-carryover-label ${isSurplus ? "is-surplus" : "is-deficit"}`}
        style={{ left: `${labelLeft}%`, opacity: labelVisible ? 1 : 0 }}
      >
        {formatSignedDuration(carryoverMinutes)}
      </div>
    </div>
  );
}
