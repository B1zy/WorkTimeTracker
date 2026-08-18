import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SessionDialogState } from "../hooks/useSessionDialog";
import type { EntryType, NewWorkSession, WorkLocation } from "../types/WorkSession";
import { formatDayHeaderLabel } from "../utils/dateUtils";
import { ENTRY_TYPE_LABEL } from "../utils/timelineLayout";

const ENTRY_TYPES: EntryType[] = ["Working", "Sick", "OvertimeCompensation", "Appointment", "Lunch"];

interface SessionDialogProps {
  state: SessionDialogState;
  onClose: () => void;
}

// Controls the single add/edit dialog. Kept as a native <dialog> element
// (required for the CSS `::backdrop` rule) whose showModal()/close() is
// driven imperatively from `state.mode`; the form itself remounts (via `key`)
// on every open so its field state always starts fresh.
export function SessionDialog({ state, onClose }: SessionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (state.mode === "closed") {
      dialog.close();
    } else if (!dialog.open) {
      dialog.showModal();
    }
  }, [state]);

  return (
    <dialog ref={dialogRef} className="session-dialog" onCancel={onClose}>
      {state.mode !== "closed" && <SessionForm key={state.key} state={state} onClose={onClose} />}
    </dialog>
  );
}

function defaultTimes(startTime: string | null, endTime: string | null): { start: string; end: string } {
  // Start: use the dragged/clicked time on the timeline, or fall back to now.
  let start: string;
  if (startTime) {
    start = startTime;
  } else {
    const now = new Date();
    start = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`;
  }

  // End: use the drag end time if provided, otherwise default to start + 1h.
  let end: string;
  if (endTime) {
    end = endTime;
  } else {
    const [sh, sm] = start.split(":").map(Number);
    const endTotalMinutes = Math.min(sh * 60 + sm + 60, 23 * 60 + 59);
    const eh = Math.floor(endTotalMinutes / 60);
    const em = endTotalMinutes % 60;
    end = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}:00`;
  }

  return { start, end };
}

interface SessionFormProps {
  state: Extract<SessionDialogState, { mode: "create" | "edit" }>;
  onClose: () => void;
}

function SessionForm({ state, onClose }: SessionFormProps) {
  const isEdit = state.mode === "edit";

  const initial = isEdit
    ? {
        name: state.session.name,
        description: state.session.description,
        location: state.session.location,
        entryType: state.session.entryType,
        start: state.session.start,
        end: state.session.end,
      }
    : (() => {
        const { start, end } = defaultTimes(state.startTime, state.endTime);
        return {
          name: ENTRY_TYPE_LABEL.Working,
          description: "",
          location: "InOffice" as WorkLocation,
          entryType: "Working" as EntryType,
          start,
          end,
        };
      })();

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [location, setLocation] = useState<WorkLocation>(initial.location);
  const [entryType, setEntryType] = useState<EntryType>(initial.entryType);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [saving, setSaving] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);
  // Tracks whether the user has typed a custom name, so switching Type keeps
  // syncing the default name (the type label) until they make it their own.
  const nameTouchedRef = useRef(isEdit);

  function handleNameChange(value: string) {
    nameTouchedRef.current = true;
    setName(value);
  }

  function handleEntryTypeChange(value: EntryType) {
    setEntryType(value);
    if (!nameTouchedRef.current) setName(ENTRY_TYPE_LABEL[value]);
  }

  useEffect(() => {
    nameInputRef.current?.focus();
    if (!isEdit) nameInputRef.current?.select();
    // Runs once per mount -- SessionForm remounts (fresh `key`) on every open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endInputRef.current?.setCustomValidity("");
  }, [start, end]);

  const dateIso = isEdit ? state.session.date : state.dateIso;
  const dateLabel = formatDayHeaderLabel(state.dateObj);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (start && end && end <= start) {
      endInputRef.current?.setCustomValidity("End time must be after start time.");
      endInputRef.current?.reportValidity();
      return;
    }
    endInputRef.current?.setCustomValidity("");

    const session: NewWorkSession = { name, description, location, entryType, date: dateIso, start, end };

    setSaving(true);
    try {
      const success = isEdit ? await state.onSave(session, state.session.id) : await state.onSave(session);
      if (success) onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    setSaving(true);
    try {
      const success = await state.onDelete();
      if (success) onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 id="dialog-title">{isEdit ? "Edit Session" : "Add Session"}</h2>
      <p className="dialog-date-label">{dateLabel}</p>

      <div className="form-row">
        <label htmlFor="name-input">Name</label>
        <input
          id="name-input"
          ref={nameInputRef}
          type="text"
          required
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
        />
      </div>

      <div className="form-row">
        <label htmlFor="description-input">Description</label>
        <input
          id="description-input"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="form-row form-row-split">
        <div>
          <label htmlFor="type-input">Type</label>
          <select id="type-input" value={entryType} onChange={(e) => handleEntryTypeChange(e.target.value as EntryType)}>
            {ENTRY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ENTRY_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="location-input">Location</label>
          <select id="location-input" value={location} onChange={(e) => setLocation(e.target.value as WorkLocation)}>
            <option value="Remote">Remote</option>
            <option value="InOffice">In Office</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div className="form-row form-row-split">
        <div>
          <label htmlFor="start-input">Start</label>
          <input
            id="start-input"
            type="time"
            step={1}
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="end-input">End</label>
          <input
            id="end-input"
            ref={endInputRef}
            type="time"
            step={1}
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
      </div>

      <div className="dialog-actions">
        <button type="button" className="btn-delete" hidden={!isEdit} onClick={handleDelete} disabled={saving}>
          Delete
        </button>
        <div className="dialog-actions-right">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {isEdit ? "Save Changes" : "Add Session"}
          </button>
        </div>
      </div>
    </form>
  );
}
