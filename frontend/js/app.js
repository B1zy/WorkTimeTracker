// Top-level state + wiring: fetches the current week's sessions, renders the
// week summary and day rows, and hooks the modal up to the API.

import { getSessions, createSession, updateSession, deleteSession } from "./api.js";
import {
  getMonday,
  addDays,
  toISODate,
  formatWeekRangeLabel,
  durationHours,
  formatHours,
} from "./dateUtils.js";
import { renderWeek } from "./timeline.js";
import { openCreateModal, openEditModal } from "./modal.js";

const WEEK_TARGET_HOURS = 42.4;
// Scale for the progress bar track. Comfortably above target so a slightly
// "over" week still shows headroom in the fill instead of just maxing out.
const SUMMARY_BAR_MAX_HOURS = 55;

const weekRangeLabel = document.getElementById("week-range-label");
const prevWeekBtn = document.getElementById("prev-week-btn");
const nextWeekBtn = document.getElementById("next-week-btn");
const totalHoursEl = document.getElementById("week-total-hours");
const statusPill = document.getElementById("week-status-pill");
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

function renderSummary(totalHours) {
  totalHoursEl.textContent = formatHours(totalHours);

  const diff = totalHours - WEEK_TARGET_HOURS;
  let state;
  let label;
  if (Math.abs(diff) < 0.05) {
    state = "target";
    label = "On Target";
  } else if (diff < 0) {
    state = "under";
    label = `${formatHours(Math.abs(diff))} Under`;
  } else {
    state = "over";
    label = `${formatHours(diff)} Over`;
  }

  statusPill.textContent = label;
  statusPill.className = `status-pill status-${state}`;
  barFill.className = `summary-bar-fill state-${state}`;
  barFill.style.width = `${Math.min((totalHours / SUMMARY_BAR_MAX_HOURS) * 100, 100)}%`;
}

// Positions the fixed target tick mark on the progress bar. The target and
// scale never change, so this only needs to run once at startup.
function positionTargetMarker() {
  barTargetMarker.style.left = `${(WEEK_TARGET_HOURS / SUMMARY_BAR_MAX_HOURS) * 100}%`;
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
    const totalHours = sessions.reduce((sum, s) => sum + durationHours(s.start, s.end), 0);

    renderSummary(totalHours);
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
