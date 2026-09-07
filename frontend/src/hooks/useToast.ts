import { useCallback, useEffect, useRef, useState } from "react";

const TOAST_DURATION_MS = 2200;
// Longer when there's an action to actually click -- 2.2s is enough to read
// a confirmation, not enough to read it and then react with an Undo click.
const TOAST_WITH_ACTION_DURATION_MS = 6000;

export interface ToastAction {
  label: string;
  onClick: () => void;
}

// A single transient status message (e.g. "Copied Monday, Aug 24") that
// clears itself after a fixed delay. Re-showing before that delay elapses
// resets the clock rather than stacking messages -- there's only ever one.
// An optional action (e.g. "Undo") renders as a button alongside the message
// and extends the auto-dismiss window.
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [action, setAction] = useState<ToastAction | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setMessage(null);
    setAction(null);
  }, []);

  const showToast = useCallback((text: string, toastAction?: ToastAction) => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setMessage(text);
    setAction(toastAction ?? null);
    timerRef.current = setTimeout(
      () => {
        setMessage(null);
        setAction(null);
      },
      toastAction ? TOAST_WITH_ACTION_DURATION_MS : TOAST_DURATION_MS
    );
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  return { message, action, showToast, dismissToast };
}
