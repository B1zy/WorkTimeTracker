// Renders the five day-rows: for each day, an hour axis + a track of
// absolutely-positioned session blocks + a total/add-button column.

import {
  timeStringToMinutes,
  durationHours,
  formatHours,
  formatTimeShort,
  formatWeekdayShort,
  formatDayShort,
  toISODate,
} from "./dateUtils.js";

// The visible timeline spans 06:00-20:00 (14 hours). Sessions outside this
// range get clamped so they can't stretch the row layout.
const DAY_START_MIN = 6 * 60;
const DAY_END_MIN = 20 * 60;
const DAY_RANGE_MIN = DAY_END_MIN - DAY_START_MIN;

// Axis tick labels, shown every 2 hours to keep the row from getting noisy.
const AXIS_HOURS = [6, 8, 10, 12, 14, 16, 18, 20];

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
// clamped to [0, 100] so an out-of-range session can't overflow the row.
function minutesToPercent(minutes) {
  const clamped = Math.min(Math.max(minutes, DAY_START_MIN), DAY_END_MIN);
  return ((clamped - DAY_START_MIN) / DAY_RANGE_MIN) * 100;
}

function buildAxis() {
  const axis = document.createElement("div");
  axis.className = "timeline-axis";
  for (const hour of AXIS_HOURS) {
    const label = document.createElement("span");
    label.textContent = `${String(hour).padStart(2, "0")}:00`;
    label.style.left = `${minutesToPercent(hour * 60)}%`;
    axis.append(label);
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
    block.style.width = `${Math.max(right - left, 1.5)}%`;
    block.textContent = session.name;
    block.title = `${session.name} · ${LOCATION_LABEL[session.location] ?? session.location} · ${formatTimeShort(session.start)}–${formatTimeShort(session.end)} · ${formatHours(durationHours(session.start, session.end))}`;
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

  const total = sessions.reduce((sum, s) => sum + durationHours(s.start, s.end), 0);
  const summary = document.createElement("div");
  summary.className = "day-row-summary";
  const totalEl = document.createElement("div");
  totalEl.className = "day-total";
  totalEl.textContent = formatHours(total);
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
