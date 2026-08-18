import { useMemo } from "react";
import { useSettings } from "../contexts/SettingsContext";
import { useOverviewData } from "../hooks/useOverviewData";
import { buildCalendarYearWeeks } from "../utils/calendar";
import { formatDuration, getMonday, toISODate } from "../utils/dateUtils";
import { workdayCount, workdayOffsets } from "../utils/workweek";
import { dayTargetMinutes } from "../utils/weekSummary";

function intensityClass(minutes: number, dayTarget: number): string {
  if (minutes <= 0) return "level-0";
  const ratio = minutes / dayTarget;
  if (ratio < 0.25) return "level-1";
  if (ratio < 0.5) return "level-2";
  if (ratio < 0.85) return "level-3";
  if (ratio <= 1.15) return "level-4";
  return "level-5";
}

function formatSignedDuration(minutes: number): string {
  const sign = minutes > 0 ? "+" : minutes < 0 ? "-" : "";
  return `${sign}${formatDuration(Math.abs(minutes))}`;
}

export function OverviewView() {
  const { settings } = useSettings();
  const year = useMemo(() => new Date().getFullYear(), []);
  const todayMonday = useMemo(() => getMonday(new Date()), []);
  // Always the full calendar year, oldest-to-newest left-to-right (January on
  // the left, December on the right), rather than a trailing window that
  // wraps around mid-year.
  const offsets = useMemo(() => workdayOffsets(settings.workdays), [settings.workdays]);
  const weeks = useMemo(() => buildCalendarYearWeeks(year, offsets), [year, offsets]);
  // Both axes are driven from the data: columns = weeks in the year, rows =
  // active work days. Cells are a fixed 11px (matching .overview-cell / the
  // legend swatches) -- the static repeat(5, 11px) / repeat(52, 11px) in
  // index.css is only a fallback for before this first render.
  const columnStyle = useMemo(() => ({ gridTemplateColumns: `repeat(${weeks.length}, 11px)` }), [weeks.length]);
  const gridStyle = useMemo(
    () => ({ ...columnStyle, gridTemplateRows: `repeat(${offsets.length}, 11px)` }),
    [columnStyle, offsets.length]
  );
  const startIso = toISODate(weeks[0][0]);
  const endIso = toISODate(weeks[weeks.length - 1][weeks[weeks.length - 1].length - 1]);
  const { minutesByDate, loading, error } = useOverviewData(startIso, endIso);

  const weekTarget = settings.weeklyTargetMinutes;
  const dayTarget = dayTargetMinutes(weekTarget, workdayCount(settings.workdays));

  const totalMinutes = useMemo(() => Object.values(minutesByDate).reduce((sum, m) => sum + m, 0), [minutesByDate]);
  // `!== 0` rather than `> 0`: with OvertimeCompensation subtracting, a day can
  // legitimately total negative and still be a day that has entries.
  const trackedDayCount = useMemo(() => Object.values(minutesByDate).filter((m) => m !== 0).length, [minutesByDate]);

  // Per-week totals, oldest first -- the basis for both the "weeks with
  // entries" average and the running carryover balance below.
  const weekTotals = useMemo(
    () => weeks.map((week) => week.reduce((sum, day) => sum + (minutesByDate[toISODate(day)] ?? 0), 0)),
    [weeks, minutesByDate]
  );

  // Only weeks that actually have entries count toward the average -- weeks
  // you haven't reached yet (or hadn't started using the app) shouldn't drag
  // it down.
  const trackedWeekCount = weekTotals.filter((m) => m !== 0).length;
  const averagePerWeek = trackedWeekCount > 0 ? totalMinutes / trackedWeekCount : 0;

  const todayMondayIso = toISODate(todayMonday);
  const currentWeekIndex = weeks.findIndex((week) => toISODate(week[0]) === todayMondayIso);

  // Running balance carried in from every tracked week strictly before the
  // current one (the current, still-in-progress week is excluded -- its own
  // progress already shows in the This Week gauge). Untracked weeks don't
  // count against you either.
  const carryoverMinutes = useMemo(() => {
    const priorWeeks = currentWeekIndex >= 0 ? weekTotals.slice(0, currentWeekIndex) : weekTotals;
    return priorWeeks.reduce((sum, minutes) => (minutes !== 0 ? sum + (minutes - weekTarget) : sum), 0);
  }, [weekTotals, weekTarget, currentWeekIndex]);

  // One label per column where the month changes, matching GitHub's
  // month-header style above the grid. The year's first/last weeks can spill
  // a few days into the adjacent year (a Monday-start week rarely lines up
  // exactly with Jan 1 or Dec 31) -- those spillover days are skipped here so
  // the leftmost label is always January, not a stray December fragment.
  const monthLabels = useMemo(() => {
    const labels: { weekIndex: number; label: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, i) => {
      for (const day of week) {
        if (day.getFullYear() !== year) continue;
        if (day.getMonth() !== lastMonth) {
          labels.push({ weekIndex: i, label: day.toLocaleDateString(undefined, { month: "short" }) });
          lastMonth = day.getMonth();
          break;
        }
      }
    });
    return labels;
  }, [weeks, year]);

  return (
    <main className="overview">
      <div className="overview-stats">
        <div className="overview-stat">
          <div className="overview-stat-value">{formatDuration(totalMinutes)}</div>
          <div className="overview-stat-label">Total tracked in {year}</div>
        </div>
        <div className="overview-stat">
          <div className="overview-stat-value">{trackedWeekCount > 0 ? formatDuration(averagePerWeek) : "—"}</div>
          <div className="overview-stat-label">Average per tracked week</div>
        </div>
        <div className="overview-stat">
          <div className="overview-stat-value">{trackedDayCount}</div>
          <div className="overview-stat-label">Days with entries</div>
        </div>
        <div className="overview-stat">
          <div className={`overview-stat-value ${carryoverMinutes >= 0 ? "is-positive" : "is-negative"}`}>
            {formatSignedDuration(carryoverMinutes)}
          </div>
          <div className="overview-stat-label">Carried over from previous weeks</div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="overview-chart-scroll">
        <div className="overview-chart">
          <div className="overview-month-row" style={columnStyle}>
            {monthLabels.map(({ weekIndex, label }) => (
              <span key={weekIndex} className="overview-month-label" style={{ gridColumnStart: weekIndex + 1 }}>
                {label}
              </span>
            ))}
          </div>
          <div className="overview-grid" style={gridStyle} aria-hidden={loading}>
            {weeks.map((week) =>
              week.map((day) => {
                const iso = toISODate(day);
                const minutes = minutesByDate[iso] ?? 0;
                const tooltip = `${day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} — ${
                  minutes !== 0 ? formatDuration(minutes) : "No entries"
                }`;
                return <div key={iso} className={`overview-cell ${intensityClass(minutes, dayTarget)}`} title={tooltip} />;
              })
            )}
          </div>
        </div>
      </div>

      <div className="overview-legend">
        <span>Less</span>
        <span className="overview-cell level-0" />
        <span className="overview-cell level-1" />
        <span className="overview-cell level-2" />
        <span className="overview-cell level-3" />
        <span className="overview-cell level-4" />
        <span className="overview-cell level-5" />
        <span>More</span>
      </div>
    </main>
  );
}
