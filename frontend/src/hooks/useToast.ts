import { useCallback, useEffect, useRef, useState } from "react";

const TOAST_DURATION_MS = 2200;

// A single transient status message (e.g. "Copied Monday, Aug 24") that
// clears itself after a fixed delay. Re-showing before that delay elapses
// resets the clock rather than stacking messages -- there's only ever one.
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string) => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setMessage(text);
    timerRef.current = setTimeout(() => setMessage(null), TOAST_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  return { message, showToast };
}
