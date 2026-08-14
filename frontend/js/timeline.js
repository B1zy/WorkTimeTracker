// Renders the five day-rows: for each day, a ruler-style hour axis + a track
// of absolutely-positioned session blocks + an LED-style total/add-button column.

import {
  timeStringToMinutes,
  durationMinutes,
  formatDuration,
  formatTimeShort,
  formatWeekdayShort,
  formatDayShort,
  toISODate,
} from "./dateUtils.js";

// The timeline always spans the full day so a session late at night can
// never render outside the row.
const DAY_START_MIN = 0;
const DAY_END_MIN = 24 * 60;
const DAY_RANGE_MIN = DAY_END_MIN - DAY_START_MIN;

// Ruler ticks: major (labeled) every 6h, minor (unlabeled) every 3h in between.
const MAJOR_HOURS = [0, 6, 12, 18, 24];
const MINOR_HOURS = [3, 9, 15, 21];

const LOCATION_CLASS = {
  Remote: "loc-remote",
  InOffice: "loc-inoffice",
  Other: "loc-other",
};

const LOCATION_LABEL = {
  Remote: "Remote",
  InOffice: "In Office",
  Other: "Other",
};

// Minutes-since-midnight -> left-offset percentage along the timeline,
// clamped to [0, 100] as a safety net (the range already covers the full day).
function minutesToPercent(minutes) {
  const clamped = Math.min(Math.max(minutes, DAY_START_MIN), DAY_END_MIN);
  return ((clamped - DAY_START_MIN) / DAY_RANGE_MIN) * 100;
}

function buildAxis() {
  const axis = document.createElement("div");
  axis.className = "timeline-axis";

  for (const hour of MINOR_HOURS) {
    const tick = document.createElement("span");
    tick.className = "axis-tick axis-tick-minor";
    tick.style.left = `${minutesToPercent(hour * 60)}%`;
    axis.append(tick);
  }

  for (const hour of MAJOR_HOURS) {
    const tick = document.createElement("span");
    tick.className = "axis-tick axis-tick-major";
    tick.style.left = `${minutesToPercent(hour * 60)}%`;

    const label = document.createElement("span");
    label.className = "axis-tick-label";
    // "24:00" (rather than wrapping to "00:00") so the ruler's end doesn't
    // look like a second copy of its start.
    label.textContent = `${String(hour).padStart(2, "0")}:00`;
    if (hour === 0) label.classList.add("axis-tick-label-start");
    if (hour === 24) label.classList.add("axis-tick-label-end");

    tick.append(label);
    axis.append(tick);
  }

  return axis;
}

function buildTrack(sessions, onSessionClick) {
  const track = document.createElement("div");
  track.className = "timeline-track";

  for (const session of sessions) {
    const left = minutesToPercent(timeStringToMinutes(session.start));
    const right = minutesToPercent(timeStringToMinutes(session.end));

    const block = document.createElement("button");
    block.type = "button";
    block.className = `timeline-block ${LOCATION_CLASS[session.location] ?? "loc-other"}`;
    block.style.left = `${left}%`;
    // Minimum width keeps very short sessions visible and clickable.
    block.style.width = `${Math.max(right - left, 1)}%`;
    block.textContent = session.name;
    block.title = `${session.name} · ${LOCATION_LABEL[session.location] ?? session.location} · ${formatTimeShort(session.start)}–${formatTimeShort(session.end)} · ${formatDuration(durationMinutes(session.start, session.end))}`;
    block.addEventListener("click", () => onSessionClick(session));

    track.append(block);
  }

  return track;
}

function buildDayRow(date, sessions, onAddClick, onSessionClick) {
  const iso = toISODate(date);
  const row = document.createElement("div");
  row.className = "day-row";

  const header = document.createElement("div");
  header.className = "day-row-header";
  const weekday = document.createElement("div");
  weekday.className = "weekday";
  weekday.textContent = formatWeekdayShort(date);
  const dateLabel = document.createElement("div");
  dateLabel.className = "date";
  dateLabel.textContent = formatDayShort(date);
  header.append(weekday, dateLabel);

  const timelineWrap = document.createElement("div");
  timelineWrap.className = "day-row-timeline";
  timelineWrap.append(buildAxis(), buildTrack(sessions, onSessionClick));

  const totalMinutes = sessions.reduce((sum, s) => sum + durationMinutes(s.start, s.end), 0);
  const summary = document.createElement("div");
  summary.className = "day-row-summary";
  const totalEl = document.createElement("div");
  totalEl.className = "day-total";
  totalEl.textContent = formatDuration(totalMinutes);
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "add-btn";
  addBtn.textContent = "+ Add";
  addBtn.addEventListener("click", () => onAddClick(iso, date));
  summary.append(totalEl, addBtn);

  row.append(header, timelineWrap, summary);
  return row;
}

// `weekDays`: array of 5 Date objects (Mon-Fri).
// `sessionsByDate`: { "YYYY-MM-DD": WorkSession[] }.
// `callbacks.onAddClick(dateIso, dateObj)` and `callbacks.onSessionClick(session)`.
export function renderWeek(container, weekDays, sessionsByDate, { onAddClick, onSessionClick }) {
  container.innerHTML = "";
  for (const date of weekDays) {
    const sessions = sessionsByDate[toISODate(date)] ?? [];
    container.append(buildDayRow(date, sessions, onAddClick, onSessionClick));
  }
}
