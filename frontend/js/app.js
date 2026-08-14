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
} from "./dateUtils.js";
import { renderWeek } from "./timeline.js";
import { openCreateModal, openEditModal } from "./modal.js";

// 42.4h happens to be exactly 2544 minutes (42h 24m) -- no rounding involved.
const WEEK_TARGET_MINUTES = 42.4 * 60;
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

// The Monday of the week currently on screen.
let currentMonday = getMonday(new Date());

function showError(message) {
  errorMessageEl.textContent = message;
  errorMessageEl.hidden = false;
}

function clearError() {
  errorMessageEl.hidden = true;
}

function renderSummary(totalMinutes) {
  totalHoursEl.textContent = formatDuration(totalMinutes);

  const diff = totalMinutes - WEEK_TARGET_MINUTES;
  let state;
  let label;
  if (Math.abs(diff) < 3) {
    // Within 3 minutes counts as "on target" -- avoids the lamp flickering
    // between states over rounding noise.
    state = "target";
    label = "On Target";
  } else if (diff < 0) {
    state = "under";
    label = `${formatDuration(Math.abs(diff))} Under`;
  } else {
    state = "over";
    label = `${formatDuration(diff)} Over`;
  }

  // Built from formatDuration()'s numeric output plus a fixed suffix, so
  // there's no user-supplied text here -- safe to set as markup.
  statusIndicator.innerHTML = `<span class="status-lamp"></span><span class="status-label">${label}</span>`;
  statusIndicator.className = `status-indicator status-${state}`;
  barFill.className = `summary-bar-fill state-${state}`;
  barFill.style.width = `${Math.min((totalMinutes / SUMMARY_METER_MAX_MINUTES) * 100, 100)}%`;
}

// Positions the fixed target needle on the gauge meter. The target and scale
// never change, so this only needs to run once at startup.
function positionTargetMarker() {
  barTargetMarker.style.left = `${(WEEK_TARGET_MINUTES / SUMMARY_METER_MAX_MINUTES) * 100}%`;
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

    const weekDays = [0, 1, 2, 3, 4].map((n) => addDays(currentMonday, n));
    const totalMinutes = sessions.reduce((sum, s) => sum + durationMinutes(s.start, s.end), 0);

    renderSummary(totalMinutes);
    renderWeek(weekRowsEl, weekDays, sessionsByDate, {
      onAddClick: handleAddClick,
      onSessionClick: handleSessionClick,
    });
  } catch (err) {
    showError(err.message);
  }
}

function handleAddClick(dateIso, dateObj) {
  openCreateModal(dateIso, dateObj, async (session) => {
    try {
      clearError();
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

prevWeekBtn.addEventListener("click", () => {
  currentMonday = addDays(currentMonday, -7);
  loadWeek();
});

nextWeekBtn.addEventListener("click", () => {
  currentMonday = addDays(currentMonday, 7);
  loadWeek();
});

positionTargetMarker();
loadWeek();
