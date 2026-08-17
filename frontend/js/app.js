// Top-level state + wiring: fetches the current week's sessions, renders the
// week summary and day rows, and hooks the modal up to the API.

import { getSessions, createSession, updateSession, deleteSession } from "./api.js";
import {
  getMonday,
  addDays,
  toISODate,
  formatWeekRangeLabel,
  durationMinutes,
  formatDuration,
  timeRangesOverlap,
} from "./dateUtils.js";
import { renderWeek } from "./timeline.js";
import { openCreateModal, openEditModal } from "./modal.js";

const WEEK_TARGET_MINUTES = 42 * 60;
// Scale for the gauge meter. Comfortably above target so a slightly "over"
// week still shows headroom in the fill instead of just maxing out.
const SUMMARY_METER_MAX_MINUTES = 55 * 60;

const weekRangeLabel = document.getElementById("week-range-label");
const prevWeekBtn = document.getElementById("prev-week-btn");
const nextWeekBtn = document.getElementById("next-week-btn");
const totalHoursEl = document.getElementById("week-total-hours");
const statusIndicator = document.getElementById("week-status-pill");
const barFill = document.getElementById("summary-bar-fill");
const barTargetMarker = document.getElementById("summary-bar-target-marker");
const weekRowsEl = document.getElementById("week-rows");
const errorMessageEl = document.getElementById("error-message");
const correctionInput = document.getElementById("correction-input");

// The Monday of the week currently on screen.
let currentMonday = getMonday(new Date());

// Retained from the last loadWeek() so the correction input can re-render the summary.
let lastTotalMinutes = 0;
// Retained from the last loadWeek() so overlap checks don't need a refetch.
let sessionsByDateCache = {};

function showError(message) {
  errorMessageEl.textContent = message;
  errorMessageEl.hidden = false;
}

function clearError() {
  errorMessageEl.hidden = true;
}

function renderSummary(totalMinutes) {
  const correctionMinutes = Number(correctionInput.value) || 0;
  const adjusted = totalMinutes + correctionMinutes;
  totalHoursEl.textContent = formatDuration(adjusted);

  const diff = adjusted - WEEK_TARGET_MINUTES;
  const deviation = Math.abs(diff) / WEEK_TARGET_MINUTES;

  // Color bands based on how far off the weekly target we are:
  //   >50% deviation → red, >25% → orange, ≤25% → green.
  let state, label;
  if (deviation > 0.50) {
    state = "over"; // red
    label = `${formatDuration(Math.abs(diff))} ${diff < 0 ? "Under" : "Over"}`;
  } else if (deviation > 0.25) {
    state = "under"; // orange
    label = `${formatDuration(Math.abs(diff))} ${diff < 0 ? "Under" : "Over"}`;
  } else if (Math.abs(diff) < 3) {
    state = "target"; // green, on target
    label = "On Target";
  } else {
    state = "target"; // green, within 25%
    label = `${formatDuration(Math.abs(diff))} ${diff < 0 ? "Under" : "Over"}`;
  }

  // Built from formatDuration()'s numeric output plus a fixed suffix, so
  // there's no user-supplied text here -- safe to set as markup.
  statusIndicator.innerHTML = `<span class="status-lamp"></span><span class="status-label">${label}</span>`;
  statusIndicator.className = `status-indicator status-${state}`;
  barFill.className = `summary-bar-fill state-${state}`;
  barFill.style.width = `${Math.min((adjusted / SUMMARY_METER_MAX_MINUTES) * 100, 100)}%`;
}

// Positions the fixed target needle on the gauge meter. The target and scale
// never change, so this only needs to run once at startup.
function positionTargetMarker() {
  barTargetMarker.style.left = `${(WEEK_TARGET_MINUTES / SUMMARY_METER_MAX_MINUTES) * 100}%`;
}

// True if `candidate` (start/end/date, optionally excluding an existing id)
// overlaps any other session already on that same day.
function hasOverlap(candidate, excludeId) {
  const daySessions = sessionsByDateCache[candidate.date] ?? [];
  return daySessions.some(
    (s) => s.id !== excludeId && timeRangesOverlap(candidate.start, candidate.end, s.start, s.end)
  );
}

async function loadWeek() {
  const friday = addDays(currentMonday, 4);
  weekRangeLabel.textContent = formatWeekRangeLabel(currentMonday, friday);

  try {
    clearError();
    const sessions = await getSessions(toISODate(currentMonday), toISODate(friday));

    // Group the flat session list into { "YYYY-MM-DD": [session, ...] }.
    const sessionsByDate = {};
    for (const session of sessions) {
      (sessionsByDate[session.date] ??= []).push(session);
    }
    sessionsByDateCache = sessionsByDate;

    const weekDays = [0, 1, 2, 3, 4].map((n) => addDays(currentMonday, n));
    const weekStart = toISODate(currentMonday);
    const weekEnd = toISODate(friday);
    const totalMinutes = sessions
      .filter((s) => s.date >= weekStart && s.date <= weekEnd)
      .reduce((sum, s) => sum + durationMinutes(s.start, s.end), 0);

    lastTotalMinutes = totalMinutes;
    renderSummary(totalMinutes);
    renderWeek(weekRowsEl, weekDays, sessionsByDate, {
      onAddClick: handleAddClick,
      onSessionClick: handleSessionClick,
      onSessionMove: handleSessionMove,
      onRemoveAllClick: handleRemoveAllClick,
    });
  } catch (err) {
    showError(err.message);
  }
}

function handleAddClick(dateIso, dateObj, startTime, endTime) {
  openCreateModal(dateIso, dateObj, startTime, endTime, async (session) => {
    try {
      clearError();
      if (hasOverlap(session, null)) {
        showError("This session overlaps an existing one.");
        return false;
      }
      await createSession(session);
      await loadWeek();
      return true;
    } catch (err) {
      showError(err.message);
      return false;
    }
  });
}

function handleSessionClick(session) {
  // "T00:00:00" forces this to parse as local time instead of UTC, so the
  // header label can't drift to the wrong day near midnight.
  const dateObj = new Date(`${session.date}T00:00:00`);

  openEditModal(
    session,
    dateObj,
    async (updated, id) => {
      try {
        clearError();
        if (hasOverlap(updated, id)) {
          showError("This session overlaps an existing one.");
          return false;
        }
        await updateSession(id, { ...updated, id });
        await loadWeek();
        return true;
      } catch (err) {
        showError(err.message);
        return false;
      }
    },
    async () => {
      try {
        clearError();
        await deleteSession(session.id);
        await loadWeek();
        return true;
      } catch (err) {
        showError(err.message);
        return false;
      }
    }
  );
}

// Called after a session block is dragged to a new position on the timeline.
// Returns true/false so timeline.js knows whether to keep the moved block or
// revert it back to its original position.
async function handleSessionMove(session, newStart, newEnd) {
  const candidate = { ...session, start: newStart, end: newEnd };
  if (hasOverlap(candidate, session.id)) {
    showError("This session overlaps an existing one.");
    return false;
  }
  try {
    clearError();
    await updateSession(session.id, { ...candidate, id: session.id });
    await loadWeek();
    return true;
  } catch (err) {
    showError(err.message);
    return false;
  }
}

async function handleRemoveAllClick(dateIso) {
  const daySessions = sessionsByDateCache[dateIso] ?? [];
  if (daySessions.length === 0) return;
  if (!confirm(`Delete all ${daySessions.length} session(s) on this day?`)) return;

  try {
    clearError();
    await Promise.all(daySessions.map((s) => deleteSession(s.id)));
    await loadWeek();
  } catch (err) {
    showError(err.message);
  }
}

correctionInput.addEventListener("input", () => renderSummary(lastTotalMinutes));

prevWeekBtn.addEventListener("click", () => {
  currentMonday = addDays(currentMonday, -7);
  correctionInput.value = "0";
  loadWeek();
});

nextWeekBtn.addEventListener("click", () => {
  currentMonday = addDays(currentMonday, 7);
  correctionInput.value = "0";
  loadWeek();
});

positionTargetMarker();
loadWeek();
