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

// Minimum pointer movement (px) before a mousedown on a session block counts
// as a drag-to-move rather than a plain click (which opens the edit modal).
const MOVE_THRESHOLD_PX = 4;

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

// A single floating tooltip element, reused (and reparented) across all day
// rows so drag interactions don't need to create/destroy DOM each time.
let tooltipEl = null;
function getTooltip() {
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.className = "drag-tooltip";
    tooltipEl.hidden = true;
    document.body.append(tooltipEl);
  }
  return tooltipEl;
}

function showTooltip(text, clientX, clientY) {
  const tooltip = getTooltip();
  tooltip.textContent = text;
  tooltip.hidden = false;
  tooltip.style.left = `${clientX}px`;
  tooltip.style.top = `${clientY}px`;
}

function hideTooltip() {
  if (tooltipEl) tooltipEl.hidden = true;
}

// "HH:MM:00" -> minutes since midnight, rounded to the nearest 5.
function snapMinutesTo5(mins) {
  return Math.round(mins / 5) * 5;
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

function buildTrack(sessions, { onSessionClick, onTrackClick, onSessionMove }) {
  const track = document.createElement("div");
  track.className = "timeline-track";

  // Ghost block shown while dragging to preview the selected range.
  const ghost = document.createElement("div");
  ghost.className = "timeline-ghost";
  ghost.hidden = true;
  track.append(ghost);

  function minsToTimeStr(mins) {
    return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}:00`;
  }

  function fractionFromEvent(event) {
    const rect = track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  }

  function minsFromFraction(fraction, snap) {
    const raw = fraction * DAY_RANGE_MIN + DAY_START_MIN;
    return snap ? snapMinutesTo5(raw) : Math.round(raw);
  }

  // --- Drag-to-select: creates a new session on empty track space. ---
  let dragStart = null; // fraction into the day where the drag began

  track.addEventListener("mousedown", (event) => {
    if (event.target !== track) return; // ignore session block clicks
    event.preventDefault(); // prevent text-selection cursor during drag
    dragStart = fractionFromEvent(event);
    ghost.hidden = false;
    ghost.style.left = `${dragStart * 100}%`;
    ghost.style.width = "0%";
  });

  document.addEventListener("mousemove", (event) => {
    if (dragStart === null) return;
    const current = fractionFromEvent(event);
    const left = Math.min(dragStart, current);
    const width = Math.abs(current - dragStart);
    ghost.style.left = `${left * 100}%`;
    ghost.style.width = `${width * 100}%`;

    const startMins = minsFromFraction(left, event.ctrlKey);
    const endMins = minsFromFraction(left + width, event.ctrlKey);
    showTooltip(
      `${formatTimeShort(minsToTimeStr(startMins))} – ${formatTimeShort(minsToTimeStr(endMins))}`,
      event.clientX,
      event.clientY
    );
  });

  document.addEventListener("mouseup", (event) => {
    if (dragStart === null) return;
    ghost.hidden = true;
    hideTooltip();
    const endFrac = fractionFromEvent(event);
    const startFrac = Math.min(dragStart, endFrac);
    const stopFrac = Math.max(dragStart, endFrac);
    dragStart = null;

    const startMins = minsFromFraction(startFrac, event.ctrlKey);
    const endMins = minsFromFraction(stopFrac, event.ctrlKey);

    // A drag shorter than 5 minutes is treated as a plain click: only the
    // start time is pre-filled and the modal calculates end = start + 1h.
    if (endMins - startMins < 5) {
      onTrackClick(minsToTimeStr(startMins), null);
    } else {
      onTrackClick(minsToTimeStr(startMins), minsToTimeStr(endMins));
    }
  });

  for (const session of sessions) {
    const startMins = timeStringToMinutes(session.start);
    const endMins = timeStringToMinutes(session.end);
    const blockDuration = endMins - startMins;
    const left = minutesToPercent(startMins);
    const right = minutesToPercent(endMins);

    const block = document.createElement("button");
    block.type = "button";
    block.className = `timeline-block ${LOCATION_CLASS[session.location] ?? "loc-other"}`;
    block.style.left = `${left}%`;
    // Minimum width keeps very short sessions visible and clickable.
    block.style.width = `${Math.max(right - left, 1)}%`;
    block.title = `${session.name} · ${LOCATION_LABEL[session.location] ?? session.location} · ${formatTimeShort(session.start)}–${formatTimeShort(session.end)} · ${formatDuration(durationMinutes(session.start, session.end))}`;

    // Name is always shown; description appears below it (faded) when present.
    const nameSpan = document.createElement("span");
    nameSpan.className = "block-name";
    nameSpan.textContent = session.name;
    block.append(nameSpan);
    if (session.description) {
      const descSpan = document.createElement("span");
      descSpan.className = "block-desc";
      descSpan.textContent = session.description;
      block.append(descSpan);
    }

    // --- Drag-to-move: repositions the block, preserving its duration. ---
    let moveStartX = null;
    let moved = false;
    let pendingStart = startMins;
    let pendingEnd = endMins;

    function onBlockMove(event) {
      const deltaX = event.clientX - moveStartX;
      if (!moved && Math.abs(deltaX) < MOVE_THRESHOLD_PX) return;
      moved = true;

      const rect = track.getBoundingClientRect();
      const deltaMins = (deltaX / rect.width) * DAY_RANGE_MIN;
      let newStart = Math.round(startMins + deltaMins);
      newStart = Math.min(Math.max(newStart, DAY_START_MIN), DAY_END_MIN - blockDuration);
      const newEnd = newStart + blockDuration;
      pendingStart = newStart;
      pendingEnd = newEnd;

      block.style.left = `${minutesToPercent(newStart)}%`;
      block.classList.add("timeline-block-dragging");
      showTooltip(
        `${formatTimeShort(minsToTimeStr(newStart))} – ${formatTimeShort(minsToTimeStr(newEnd))}`,
        event.clientX,
        event.clientY
      );
    }

    async function onBlockUp() {
      document.removeEventListener("mousemove", onBlockMove);
      document.removeEventListener("mouseup", onBlockUp);
      moveStartX = null;
      hideTooltip();
      block.classList.remove("timeline-block-dragging");

      if (!moved) return; // handled as a plain click below

      const ok = await onSessionMove(session, minsToTimeStr(pendingStart), minsToTimeStr(pendingEnd));
      if (!ok) {
        // Revert visually since a failed move doesn't trigger a re-render.
        block.style.left = `${left}%`;
        block.classList.add("timeline-block-invalid");
        setTimeout(() => block.classList.remove("timeline-block-invalid"), 400);
      }
    }

    block.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault(); // prevent text-selection cursor during drag
      moveStartX = event.clientX;
      moved = false;
      pendingStart = startMins;
      pendingEnd = endMins;
      document.addEventListener("mousemove", onBlockMove);
      document.addEventListener("mouseup", onBlockUp);
    });

    block.addEventListener("click", () => {
      if (moved) {
        moved = false; // consume: a drag shouldn't also open the edit modal
        return;
      }
      onSessionClick(session);
    });

    track.append(block);
  }

  return track;
}

function buildDayRow(date, sessions, { onAddClick, onSessionClick, onSessionMove, onRemoveAllClick }) {
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
  const onTrackClick = (startTime, endTime) => onAddClick(iso, date, startTime, endTime);
  timelineWrap.append(buildAxis(), buildTrack(sessions, { onSessionClick, onTrackClick, onSessionMove }));

  const totalMinutes = sessions.reduce((sum, s) => sum + durationMinutes(s.start, s.end), 0);
  const summary = document.createElement("div");
  summary.className = "day-row-summary";
  const totalEl = document.createElement("div");
  totalEl.className = "day-total";
  totalEl.textContent = formatDuration(totalMinutes);

  const actions = document.createElement("div");
  actions.className = "day-row-actions";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "add-btn";
  addBtn.textContent = "+ Add";
  addBtn.addEventListener("click", () => onAddClick(iso, date));
  const removeAllBtn = document.createElement("button");
  removeAllBtn.type = "button";
  removeAllBtn.className = "remove-all-btn";
  removeAllBtn.textContent = "Clear";
  removeAllBtn.title = "Remove all entries for this day";
  removeAllBtn.addEventListener("click", () => onRemoveAllClick(iso));
  actions.append(addBtn, removeAllBtn);

  summary.append(totalEl, actions);

  row.append(header, timelineWrap, summary);
  return row;
}

// `weekDays`: array of 5 Date objects (Mon-Fri).
// `sessionsByDate`: { "YYYY-MM-DD": WorkSession[] }.
// `callbacks`: onAddClick(dateIso, dateObj), onSessionClick(session),
// onSessionMove(session, newStart, newEnd), onRemoveAllClick(dateIso).
export function renderWeek(container, weekDays, sessionsByDate, callbacks) {
  container.innerHTML = "";
  for (const date of weekDays) {
    const sessions = sessionsByDate[toISODate(date)] ?? [];
    container.append(buildDayRow(date, sessions, callbacks));
  }
}
