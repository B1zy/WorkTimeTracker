// Controls the single add/edit <dialog> in index.html. It's reused for both
// modes -- openCreateModal/openEditModal just reconfigure it before showing.

import { formatDayHeaderLabel } from "./dateUtils.js";

const dialog = document.getElementById("session-dialog");
const form = document.getElementById("session-form");
const dialogTitle = document.getElementById("dialog-title");
const dialogDateLabel = document.getElementById("dialog-date-label");
const idInput = document.getElementById("session-id");
const dateInput = document.getElementById("session-date");
const nameInput = document.getElementById("name-input");
const descriptionInput = document.getElementById("description-input");
const locationInput = document.getElementById("location-input");
const startInput = document.getElementById("start-input");
const endInput = document.getElementById("end-input");
const saveBtn = document.getElementById("save-btn");
const deleteBtn = document.getElementById("delete-btn");
const cancelBtn = document.getElementById("cancel-btn");

// Reassigned each time the modal opens, so the one submit/delete listener
// below (attached once, further down) always calls whatever the current
// caller asked for. `onSave`/`onDelete` are expected to return true on
// success and false on failure (app.js handles the try/catch), so the modal
// only closes itself when the save/delete actually went through.
let onSave = null;
let onDelete = null;

function resetForm() {
  form.reset();
  idInput.value = "";
}

export function openCreateModal(dateIso, dateObj, saveHandler) {
  resetForm();
  dialogTitle.textContent = "Add Session";
  dialogDateLabel.textContent = formatDayHeaderLabel(dateObj);
  dateInput.value = dateIso;
  saveBtn.textContent = "Add Session";
  deleteBtn.hidden = true;
  onSave = saveHandler;
  onDelete = null;
  dialog.showModal();
  nameInput.focus();
}

export function openEditModal(session, dateObj, saveHandler, deleteHandler) {
  resetForm();
  dialogTitle.textContent = "Edit Session";
  dialogDateLabel.textContent = formatDayHeaderLabel(dateObj);
  idInput.value = session.id;
  dateInput.value = session.date;
  nameInput.value = session.name;
  descriptionInput.value = session.description;
  locationInput.value = session.location;
  // <input type="time" step="1"> accepts "HH:MM:SS" directly.
  startInput.value = session.start;
  endInput.value = session.end;
  saveBtn.textContent = "Save Changes";
  deleteBtn.hidden = false;
  onSave = saveHandler;
  onDelete = deleteHandler;
  dialog.showModal();
  nameInput.focus();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!onSave) return;

  const session = {
    name: nameInput.value,
    description: descriptionInput.value,
    location: locationInput.value,
    date: dateInput.value,
    start: startInput.value,
    end: endInput.value,
  };

  const id = idInput.value ? Number(idInput.value) : null;
  const success = await onSave(session, id);
  if (success) dialog.close();
});

deleteBtn.addEventListener("click", async () => {
  if (!onDelete) return;
  if (!confirm("Delete this session?")) return;
  const success = await onDelete();
  if (success) dialog.close();
});

cancelBtn.addEventListener("click", () => dialog.close());
