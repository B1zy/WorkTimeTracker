import { useMemo, type CSSProperties } from "react";
import { useSettings } from "../contexts/SettingsContext";
import { useOverviewData } from "../hooks/useOverviewData";
import { buildCalendarYearWeeks } from "../utils/calendar";
import { formatDuration, getMonday, toISODate } from "../utils/dateUtils";
import { ENTRY_TYPE_LABEL } from "../utils/timelineLayout";
import { WEEKDAY_LABEL, workdayCount, workdayOffsets, type Weekday } from "../utils/workweek";
import { classifySummaryState, dayTargetMinutes, meterMaxMinutes } from "../utils/weekSummary";
import type { EntryType } from "../types/WorkSession";
import { SettingsPanel } from "./SettingsPanel";
import { SettingsSidebar } from "./SettingsSidebar";

// Charted in this fixed order (rather than however each week's sessions
// happen to sort) so a type's line/legend position stays put week to week.
const CHART_ENTRY_TYPES: EntryType[] = ["Working", "Sick", "OvertimeCompensation", "Appointment", "Lunch"];

// Levels 1-4 scale linearly from 0h up to the daily target (100%); level 5 is
// reserved for days that beat the target by a full hour or more, so "hit your
// goal" and "blew past it" read as visibly different intensities.
function intensityClass(minutes: number, dayTarget: number): string {
  if (minutes <= 0) return "level-0";
  if (minutes >= dayTarget + 60) return "level-5";
  const ratio = minutes / dayTarget;
  if (ratio <= 0.25) return "level-1";
  if (ratio <= 0.5) return "level-2";
  if (ratio <= 0.75) return "level-3";
  return "level-4";
}

function formatSignedDuration(minutes: number): string {
  const sign = minutes > 0 ? "+" : minutes < 0 ? "-" : "";
  return `${sign}${formatDuration(Math.abs(minutes))}`;
}

const RECENT_WEEK_COUNT = 13;

interface OverviewViewProps {
  onClearAllData: () => Promise<void>;
  onExportData: () => Promise<void>;
  onImportData: (
    file: File,
    onProgress?: (done: number, total: number) => void
  ) => Promise<{ imported: number; failed: number }>;
}

export function OverviewView({ onClearAllData, onExportData, onImportData }: OverviewViewProps) {
  const { settings } = useSettings();
  const year = useMemo(() => new Date().getFullYear(), []);
  const todayMonday = useMemo(() => getMonday(new Date()), []);
  // Always the full calendar year, oldest-to-newest left-to-right (January on
  // the left, December on the right), rather than a trailing window that
  // wraps around mid-year.
  const offsets = useMemo(() => workdayOffsets(settings.workdays), [settings.workdays]);
  const weeks = useMemo(() => buildCalendarYearWeeks(year, offsets), [year, offsets]);
  // Both axes are driven from the data: columns = weeks in the year, rows =
  // active work days. Columns are fluid (not a fixed px size) so the whole
  // grid always exactly fits its container width -- no horizontal scrollbar
  // regardless of how much room the settings sidebar leaves it. Rows are
  // "auto": each cell's aspect-ratio (in index.css) derives its height from
  // its own fluid column width, which is what keeps the cells square.
  const columnStyle = useMemo(
    () => ({ gridTemplateColumns: `repeat(${weeks.length}, minmax(3px, 1fr))` }),
    [weeks.length]
  );
  const gridStyle = useMemo(
    () => ({ ...columnStyle, gridTemplateRows: `repeat(${offsets.length}, auto)` }),
    [columnStyle, offsets.length]
  );
  const startIso = toISODate(weeks[0][0]);
  const endIso = toISODate(weeks[weeks.length - 1][weeks[weeks.length - 1].length - 1]);
  const { minutesByDate, minutesByDateAndType, loading, error } = useOverviewData(startIso, endIso);

  // "Working" has no user-customizable color (it's colored by location on the
  // timebar instead) -- accent is what the rest of the app already uses for
  // it, so the line chart stays visually consistent with the heatmap/bars.
  const entryTypeColor: Record<EntryType, string> = {
    Working: "var(--accent)",
    Sick: settings.colors.typeSick,
    OvertimeCompensation: settings.colors.typeOvertimeCompensation,
    Appointment: settings.colors.typeAppointment,
    Lunch: settings.colors.typeLunch,
  };

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

  // Weekly-hours bar chart: same column grid as the heatmap below it (so the
  // two read as one aligned trend view), scaled with the same headroom ratio
  // as the This Week gauge. A week with no entries gets a neutral bar rather
  // than being colored "way off target" -- it likely just hasn't happened yet.
  const weekMax = meterMaxMinutes(weekTarget);
  const weekBars = useMemo(
    () =>
      weekTotals.map((minutes, i) => ({
        key: toISODate(weeks[i][0]),
        heightPercent: Math.min((Math.abs(minutes) / weekMax) * 100, 100),
        state: minutes !== 0 ? classifySummaryState(minutes, weekTarget) : null,
        tooltip: `Week of ${weeks[i][0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} — ${
          minutes !== 0 ? formatDuration(minutes) : "No entries"
        }`,
      })),
    [weekTotals, weeks, weekMax, weekTarget]
  );
  const weekTargetLinePercent = Math.min((weekTarget / weekMax) * 100, 100);

  // By-weekday averages: for each active weekday, the mean of its tracked
  // days across the whole year -- answers "which days do I actually work
  // more/less", which the calendar heatmap can't show at a glance.
  const weekdayBars = useMemo(() => {
    const rowWeekdays = offsets.map((offset) => ((offset + 1) % 7) as Weekday);
    const sums = rowWeekdays.map(() => 0);
    const counts = rowWeekdays.map(() => 0);
    weeks.forEach((week) => {
      week.forEach((day, rowIndex) => {
        const minutes = minutesByDate[toISODate(day)];
        if (minutes) {
          sums[rowIndex] += minutes;
          counts[rowIndex]++;
        }
      });
    });
    return rowWeekdays.map((weekday, i) => ({
      weekday,
      tracked: counts[i] > 0,
      average: counts[i] > 0 ? sums[i] / counts[i] : 0,
    }));
  }, [weeks, minutesByDate, offsets]);
  const weekdayMax = Math.max(dayTarget * 1.05, ...weekdayBars.map((w) => w.average));
  const weekdayTargetLinePercent = Math.min((dayTarget / weekdayMax) * 100, 100);

  // Recent-weeks line chart: the bar chart above already covers the full
  // year (and the total), so this is deliberately just the last quarter --
  // and, since the total is already up there, this one breaks that same
  // window down by session type instead of repeating it. Ends at the current
  // week (or the year's last tracked week, for a moment right at a year
  // boundary).
  const recentWeeks = useMemo(() => {
    const endIndex = currentWeekIndex >= 0 ? currentWeekIndex : weekTotals.length - 1;
    const startIndex = Math.max(0, endIndex - RECENT_WEEK_COUNT + 1);
    return weeks.slice(startIndex, endIndex + 1).map((week) => ({
      weekStart: week[0],
      // Raw (un-weighted) minutes per entry type -- the composition of the
      // week, not the counted total the bar chart above already shows.
      byType: CHART_ENTRY_TYPES.reduce((acc, type) => {
        acc[type] = week.reduce((sum, day) => sum + (minutesByDateAndType[toISODate(day)]?.[type] ?? 0), 0);
        return acc;
      }, {} as Record<EntryType, number>),
    }));
  }, [weeks, currentWeekIndex, weekTotals.length, minutesByDateAndType]);

  // Only chart types that actually occurred in this window -- a flat zero
  // line for a type nobody logged would just be legend noise.
  const activeChartTypes = useMemo(
    () => CHART_ENTRY_TYPES.filter((type) => recentWeeks.some((w) => w.byType[type] > 0)),
    [recentWeeks]
  );

  const lineChartWidth = 220;
  const lineChartHeight = 56;
  const typeChartMax = Math.max(1, ...recentWeeks.flatMap((w) => activeChartTypes.map((type) => w.byType[type])));
  const typeLines = activeChartTypes.map((type) => {
    const n = recentWeeks.length;
    const points = recentWeeks.map((w, i) => ({
      x: n > 1 ? (i / (n - 1)) * lineChartWidth : lineChartWidth / 2,
      y: lineChartHeight - (w.byType[type] / typeChartMax) * lineChartHeight,
      minutes: w.byType[type],
      weekStart: w.weekStart,
    }));
    return {
      type,
      color: entryTypeColor[type],
      path: points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
      points,
    };
  });

  return (
    <div className="overview-page">
      <div className="overview-page-top">
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

        <h3 className="overview-section-title">Weekly hours</h3>
        <div className="overview-chart-scroll">
          <div className="overview-chart">
            <div className="overview-month-row" style={columnStyle}>
              {monthLabels.map(({ weekIndex, label }) => (
                <span key={weekIndex} className="overview-month-label" style={{ gridColumnStart: weekIndex + 1 }}>
                  {label}
                </span>
              ))}
            </div>
            <div className="overview-week-chart-wrap">
              <div className="overview-target-line" style={{ bottom: `${weekTargetLinePercent}%` }} />
              <div className="overview-week-chart" style={columnStyle}>
                {weekBars.map((bar) => (
                  <div key={bar.key} className="overview-bar" title={bar.tooltip}>
                    <div
                      className={`overview-bar-fill${bar.state ? ` state-${bar.state}` : ""}`}
                      style={{ height: `${bar.heightPercent}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="overview-grid" style={gridStyle} aria-hidden={loading}>
              {weeks.map((week, weekIndex) =>
                week.map((day) => {
                  const iso = toISODate(day);
                  const minutes = minutesByDate[iso] ?? 0;
                  const tooltip = `${day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} — ${
                    minutes !== 0 ? formatDuration(minutes) : "No entries"
                  }`;
                  return (
                    <div
                      key={iso}
                      className={`overview-cell ${intensityClass(minutes, dayTarget)}`}
                      style={{ "--week-index": weekIndex } as CSSProperties}
                      title={tooltip}
                    />
                  );
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

        <div className="overview-secondary-charts">
          <div className="overview-secondary-chart">
            <h3 className="overview-section-title overview-section-title-spaced">Average by weekday</h3>
            <div className="overview-weekday-chart">
              {weekdayBars.map(({ weekday, tracked, average }) => (
                <div key={weekday} className="overview-weekday-row">
                  <span className="overview-weekday-label">{WEEKDAY_LABEL[weekday]}</span>
                  <div className="overview-weekday-track">
                    <div className="overview-weekday-target-tick" style={{ left: `${weekdayTargetLinePercent}%` }} />
                    <div
                      className={`overview-weekday-fill${tracked ? ` state-${classifySummaryState(average, dayTarget)}` : ""}`}
                      style={{ width: `${Math.min((average / weekdayMax) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="overview-weekday-value">{tracked ? formatDuration(average) : "—"}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overview-secondary-chart overview-line-chart-col">
            <h3 className="overview-section-title overview-section-title-spaced">
              Last {recentWeeks.length} weeks by type
            </h3>
            <svg
              className="overview-line-chart"
              viewBox={`0 0 ${lineChartWidth} ${lineChartHeight}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={`Weekly hours by session type over the last ${recentWeeks.length} weeks`}
            >
              {typeLines.map(
                ({ type, color, path, points }) =>
                  points.length > 1 && <path key={type} className="overview-line-path" style={{ stroke: color }} d={path} />
              )}
              {typeLines.map(({ type, color, points }) =>
                points.map((p) => (
                  <circle
                    key={`${type}-${p.weekStart.toISOString()}`}
                    className="overview-line-dot"
                    style={{ fill: color }}
                    cx={p.x}
                    cy={p.y}
                    r={2.2}
                  >
                    <title>
                      {ENTRY_TYPE_LABEL[type]} · Week of{" "}
                      {p.weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} —{" "}
                      {p.minutes > 0 ? formatDuration(p.minutes) : "No entries"}
                    </title>
                  </circle>
                ))
              )}
            </svg>
            <div className="overview-type-legend">
              {activeChartTypes.map((type) => (
                <span key={type} className="overview-type-legend-item">
                  <span className="overview-type-legend-dot" style={{ background: entryTypeColor[type] }} />
                  {ENTRY_TYPE_LABEL[type]}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="overview-state-legend">
          <span className="overview-state-chip state-target" />
          On target
          <span className="overview-state-chip state-under" />
          Off pace
          <span className="overview-state-chip state-over" />
          Way off
        </div>
      </main>

      <SettingsSidebar />
      </div>

      <SettingsPanel onClearAllData={onClearAllData} onExportData={onExportData} onImportData={onImportData} />
    </div>
  );
}
