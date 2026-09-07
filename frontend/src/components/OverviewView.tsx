import { useMemo, type CSSProperties } from "react";
import { useSettings } from "../contexts/SettingsContext";
import { useOverviewData } from "../hooks/useOverviewData";
import { buildCalendarYearWeeks } from "../utils/calendar";
import { formatDuration, formatSignedDuration, getMonday, toISODate } from "../utils/dateUtils";
import { ENTRY_TYPE_LABEL } from "../utils/timelineLayout";
import { WEEKDAY_LABEL, workdayCount, workdayOffsets, type Weekday } from "../utils/workweek";
import {
  classifyDayCellState,
  classifySummaryState,
  classifyWeekdayAverageState,
  dayTargetMinutes,
  meterMaxMinutes,
} from "../utils/weekSummary";
import type { CorrectionsByWeek } from "../utils/corrections";
import type { EntryType } from "../types/WorkSession";
import { SettingsPanel } from "./SettingsPanel";
import { SettingsSidebar } from "./SettingsSidebar";

// Charted in this fixed order (rather than however each week's sessions
// happen to sort) so a type's line/legend position stays put week to week.
const CHART_ENTRY_TYPES: EntryType[] = ["Working", "Sick", "OvertimeCompensation", "Appointment", "Lunch"];

// Colors each day by whether it met, missed, or blew past that day's target
// -- a distinct hue per state (see classifyDayCellState) instead of a
// single-hue intensity ramp, which made every worked day look like a shade
// of the same color and left "fell short" and "hit the goal" for only
// saturation to tell apart.
function dayCellClass(minutes: number, dayTarget: number): string {
  if (minutes <= 0) return "cell-empty";
  return `cell-${classifyDayCellState(minutes, dayTarget)}`;
}

// A day at 200%+ of its target mixes in this much black; ratios below scale
// down linearly from there, so 0% over (exactly on target) is the plain
// base green and anything past the cap just holds at the darkest shade
// instead of drifting toward unreadable black.
const OVER_TARGET_DARKEN_CAP_RATIO = 1;
const OVER_TARGET_MAX_DARKEN_PERCENT = 55;

// Every under-target day is a flat color (red or amber) -- the point there
// is an immediate, binary "this needs attention", not a gradient. A day
// past its target has no such urgency, so it gets to keep the "how much"
// story a flat green would otherwise lose: the further over, the darker
// (richer) the green, layered on top of the same .cell-target base color
// via color-mix rather than a second hardcoded color.
function dayCellStyle(minutes: number, dayTarget: number, weekIndex: number): CSSProperties {
  const style: CSSProperties = { "--week-index": weekIndex } as CSSProperties;
  if (dayTarget > 0 && minutes > dayTarget) {
    const overRatio = (minutes - dayTarget) / dayTarget;
    const darkenPercent = Math.min(overRatio / OVER_TARGET_DARKEN_CAP_RATIO, 1) * OVER_TARGET_MAX_DARKEN_PERCENT;
    style.backgroundColor = `color-mix(in srgb, var(--state-target) ${100 - darkenPercent}%, black ${darkenPercent}%)`;
  }
  return style;
}

const RECENT_WEEK_COUNT = 13;

interface OverviewViewProps {
  onClearAllData: () => Promise<void>;
  onExportData: () => Promise<void>;
  onImportData: (
    file: File,
    onProgress?: (done: number, total: number) => void
  ) => Promise<{ imported: number; failed: number }>;
  corrections: CorrectionsByWeek;
}

export function OverviewView({ onClearAllData, onExportData, onImportData, corrections }: OverviewViewProps) {
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

  // Running balance carried in from every week strictly before the current
  // one (the current, still-in-progress week is excluded -- its own progress
  // already shows in the This Week gauge), starting from the first week that
  // has any activity at all (a session or a correction) -- weeks before that
  // haven't started being tracked and don't count, but every week from there
  // on does, so a completely missed week still subtracts its full target
  // rather than being silently skipped.
  const carryoverMinutes = useMemo(() => {
    const priorCount = currentWeekIndex >= 0 ? currentWeekIndex : weekTotals.length;
    let firstTrackedIndex = -1;
    for (let i = 0; i < priorCount; i++) {
      const correction = corrections[toISODate(weeks[i][0])] ?? 0;
      if (weekTotals[i] !== 0 || correction !== 0) {
        firstTrackedIndex = i;
        break;
      }
    }
    if (firstTrackedIndex === -1) return 0;

    let sum = 0;
    for (let i = firstTrackedIndex; i < priorCount; i++) {
      const correction = corrections[toISODate(weeks[i][0])] ?? 0;
      sum += weekTotals[i] + correction - weekTarget;
    }
    return sum;
  }, [weekTotals, weeks, weekTarget, currentWeekIndex, corrections]);

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

  // Per-month totals across the whole year -- same underlying day data as
  // the heatmap/weekly chart above, just bucketed by calendar month instead
  // of week. Each month's own target scales with how many active workdays
  // actually fall in it (28-31 days, weekends/non-workdays excluded), so a
  // short February isn't held to the same bar as a full March -- shown as a
  // tick mark on each bar rather than one shared line, since (unlike the
  // weekly chart, where every week shares the same target) that target
  // moves bar to bar.
  const monthBars = useMemo(() => {
    const totals = new Array(12).fill(0) as number[];
    const workdayCounts = new Array(12).fill(0) as number[];
    weeks.forEach((week) => {
      week.forEach((day) => {
        if (day.getFullYear() !== year) return;
        const m = day.getMonth();
        totals[m] += minutesByDate[toISODate(day)] ?? 0;
        workdayCounts[m]++;
      });
    });

    const targets = workdayCounts.map((count) => count * dayTarget);
    const maxValue = Math.max(1, ...totals.map((m) => Math.abs(m)), ...targets);

    return totals.map((minutes, i) => {
      const monthDate = new Date(year, i, 1);
      const tracked = workdayCounts[i] > 0 && minutes !== 0;
      return {
        key: i,
        label: monthDate.toLocaleDateString(undefined, { month: "short" }),
        heightPercent: Math.min((Math.abs(minutes) / maxValue) * 100, 100),
        targetPercent: Math.min((targets[i] / maxValue) * 100, 100),
        state: tracked ? classifySummaryState(minutes, targets[i]) : null,
        tooltip: `${monthDate.toLocaleDateString(undefined, { month: "long" })} — ${
          minutes !== 0 ? formatDuration(minutes) : "No entries"
        }${workdayCounts[i] > 0 ? ` / ${formatDuration(targets[i])} target` : ""}`,
      };
    });
  }, [weeks, year, minutesByDate, dayTarget]);

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

  // Recent-weeks window: the bar chart above already covers the full year
  // (and the total), so this is deliberately just the last quarter -- and,
  // since the total is already up there, this breaks that same window down
  // by session type instead of repeating it. Ends at the current week (or
  // the year's last tracked week, for a moment right at a year boundary).
  const recentWeeks = useMemo(() => {
    const endIndex = currentWeekIndex >= 0 ? currentWeekIndex : weekTotals.length - 1;
    const startIndex = Math.max(0, endIndex - RECENT_WEEK_COUNT + 1);
    return weeks.slice(startIndex, endIndex + 1);
  }, [weeks, currentWeekIndex, weekTotals.length]);

  // Raw (un-weighted) minutes per entry type, summed across the whole
  // window -- the composition of the period, not the counted total the bar
  // chart above already shows.
  const typeTotals = useMemo(() => {
    const totals = CHART_ENTRY_TYPES.reduce((acc, type) => ({ ...acc, [type]: 0 }), {} as Record<EntryType, number>);
    for (const week of recentWeeks) {
      for (const day of week) {
        const byType = minutesByDateAndType[toISODate(day)];
        if (!byType) continue;
        for (const type of CHART_ENTRY_TYPES) {
          totals[type] += byType[type] ?? 0;
        }
      }
    }
    return totals;
  }, [recentWeeks, minutesByDateAndType]);

  // Only chart types that actually occurred in this window -- a zero-width
  // segment for a type nobody logged would just be clutter.
  const activeChartTypes = CHART_ENTRY_TYPES.filter((type) => typeTotals[type] > 0);
  const typeGrandTotal = activeChartTypes.reduce((sum, type) => sum + typeTotals[type], 0);
  // Segments of one 100%-wide bar (the window's total tracked time), not
  // separate bars each scaled to their own max -- share of the whole is the
  // point, not a type-to-type size comparison.
  const typeBars = activeChartTypes.map((type) => ({
    type,
    color: entryTypeColor[type],
    minutes: typeTotals[type],
    sharePercent: typeGrandTotal > 0 ? (typeTotals[type] / typeGrandTotal) * 100 : 0,
  }));

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
                      className={`overview-cell ${dayCellClass(minutes, dayTarget)}`}
                      style={dayCellStyle(minutes, dayTarget, weekIndex)}
                      title={tooltip}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="overview-legend">
          <span className="overview-cell cell-empty" />
          <span>No data</span>
          <span className="overview-cell cell-under" />
          <span>Off pace</span>
          <span className="overview-cell cell-target" />
          <span>On target</span>
          <span className="overview-cell cell-over" />
          <span>Way off</span>
        </div>

        <h3 className="overview-section-title overview-section-title-spaced">Monthly hours</h3>
        <div className="overview-month-chart">
          {monthBars.map((bar) => (
            <div key={bar.key} className="overview-month-bar-col">
              <div className="overview-bar overview-month-bar" title={bar.tooltip}>
                <div className="overview-month-bar-target-tick" style={{ bottom: `${bar.targetPercent}%` }} />
                <div
                  className={`overview-bar-fill${bar.state ? ` state-${bar.state}` : ""}`}
                  style={{ height: `${bar.heightPercent}%` }}
                />
              </div>
              <span className="overview-month-bar-label">{bar.label}</span>
            </div>
          ))}
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
                      className={`overview-weekday-fill${tracked ? ` state-${classifyWeekdayAverageState(average, dayTarget)}` : ""}`}
                      style={{ width: `${Math.min((average / weekdayMax) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="overview-weekday-value">{tracked ? formatDuration(average) : "—"}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overview-secondary-chart overview-type-stack-col">
            <h3 className="overview-section-title overview-section-title-spaced">
              Last {recentWeeks.length} weeks by type
            </h3>
            {/* One 100%-wide bar, segmented by type -- not one bar per type. */}
            <div className="overview-type-stack-track">
              {typeBars.map(({ type, color, minutes, sharePercent }) => (
                <div
                  key={type}
                  className="overview-type-stack-segment"
                  style={{ width: `${sharePercent}%`, background: color }}
                  title={`${ENTRY_TYPE_LABEL[type]} — ${formatDuration(minutes)} (${sharePercent.toFixed(0)}%)`}
                />
              ))}
            </div>
            <div className="overview-type-stack-legend">
              {typeBars.map(({ type, color, minutes, sharePercent }) => (
                <span key={type} className="overview-type-stack-legend-item">
                  <span className="overview-type-bar-dot" style={{ background: color }} />
                  {ENTRY_TYPE_LABEL[type]} · {formatDuration(minutes)} · {sharePercent.toFixed(0)}%
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
