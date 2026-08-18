import { useCallback, useState } from "react";
import type { NewWorkSession, WorkSession } from "../types/WorkSession";

export type SessionDialogState =
  | { mode: "closed" }
  | {
      mode: "create";
      key: number;
      dateIso: string;
      dateObj: Date;
      startTime: string | null;
      endTime: string | null;
      onSave: (session: NewWorkSession) => Promise<boolean>;
    }
  | {
      mode: "edit";
      key: number;
      session: WorkSession;
      dateObj: Date;
      onSave: (session: NewWorkSession, id: number) => Promise<boolean>;
      onDelete: () => Promise<boolean>;
    };

// Controls the single add/edit dialog. `key` increments on every open call so
// SessionDialog can remount its form (resetting field state) the same way the
// original vanilla modal called `form.reset()` on every open.
export function useSessionDialog() {
  const [state, setState] = useState<SessionDialogState>({ mode: "closed" });

  const openCreate = useCallback(
    (
      dateIso: string,
      dateObj: Date,
      startTime: string | null,
      endTime: string | null,
      onSave: (session: NewWorkSession) => Promise<boolean>
    ) => {
      setState((prev) => ({
        mode: "create",
        key: (prev.mode === "closed" ? 0 : prev.key) + 1,
        dateIso,
        dateObj,
        startTime,
        endTime,
        onSave,
      }));
    },
    []
  );

  const openEdit = useCallback(
    (
      session: WorkSession,
      dateObj: Date,
      onSave: (session: NewWorkSession, id: number) => Promise<boolean>,
      onDelete: () => Promise<boolean>
    ) => {
      setState((prev) => ({
        mode: "edit",
        key: (prev.mode === "closed" ? 0 : prev.key) + 1,
        session,
        dateObj,
        onSave,
        onDelete,
      }));
    },
    []
  );

  const close = useCallback(() => setState({ mode: "closed" }), []);

  return { state, openCreate, openEdit, close };
}
