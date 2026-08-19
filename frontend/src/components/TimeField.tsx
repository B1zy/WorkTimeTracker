// A from-scratch 24h time control -- two digit segments (HH/MM), each typed
// into directly, plus a picker button that opens a menu of exact hour/minute
// values to click -- rather than the native <input type="time">, which
// formats in 12h AM/PM depending on the browser/OS locale no matter what we
// do. Working in minutes since midnight end to end sidesteps that entirely:
// the value is just a number, so there's no locale-dependent formatting to
// fight. Hours run 0-23 and wrap at midnight like an actual clock -- there's
// no 24th hour to represent.
//
// Typing behaves like a native date/time spinner: a digit that can't be the
// start of a larger valid value (e.g. "4" for an hour, since 40-49 are out
// of range) commits immediately and hops to the next segment; otherwise it
// waits for a second digit. Arrow keys and the scroll wheel still step by
// one, wrapping at the ends, for anyone used to that; the picker menu is the
// discoverable way to jump straight to an exact value.

import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent, type WheelEvent } from "react";

interface TimeFieldProps {
  id?: string;
  value: number; // minutes since midnight, 0-1439
  onChange: (minutes: number) => void;
  ariaLabel: string;
  compact?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Wrapping +1/-1, e.g. wrap(23, 1, 24) -> 0, wrap(0, -1, 24) -> 23.
function wrap(n: number, delta: number, span: number): number {
  return ((n + delta) % span + span) % span;
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.1" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 4.6V8.2l2.5 1.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TimeField({ id, value, onChange, ariaLabel, compact }: TimeFieldProps) {
  const total = clamp(Math.round(value), 0, 1439);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  const minuteRef = useRef<HTMLInputElement>(null);
  const hourRef = useRef<HTMLInputElement>(null);
  const [hourDraft, setHourDraft] = useState("");
  const [minuteDraft, setMinuteDraft] = useState("");

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);
  // Fixed-position coordinates rather than the field's own CSS (absolute,
  // anchored to the field) so the popover floats free of whatever container
  // it's in -- notably a <dialog>, which defaults to overflow:auto and would
  // otherwise grow a scrollbar to fit a popover that pokes past its edge.
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;

    function reposition() {
      const fieldEl = containerRef.current;
      const popoverEl = popoverRef.current;
      if (!fieldEl || !popoverEl) return;
      const fieldRect = fieldEl.getBoundingClientRect();
      const popoverRect = popoverEl.getBoundingClientRect();
      const margin = 8;

      const spaceBelow = window.innerHeight - fieldRect.bottom;
      const openUpward = spaceBelow < popoverRect.height + margin && fieldRect.top > popoverRect.height + margin;
      const top = openUpward ? fieldRect.top - popoverRect.height - margin : fieldRect.bottom + margin;
      const left = Math.min(fieldRect.left, window.innerWidth - popoverRect.width - margin);

      setPopoverStyle({ position: "fixed", top, left: Math.max(margin, left), visibility: "visible" });
    }

    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setPopoverStyle({});
      return;
    }
    hourListRef.current?.querySelector<HTMLElement>('[data-selected="true"]')?.scrollIntoView({ block: "center" });
    minuteListRef.current?.querySelector<HTMLElement>('[data-selected="true"]')?.scrollIntoView({ block: "center" });
  }, [isOpen]);

  function commit(newHours: number, newMinutes: number) {
    onChange(clamp(newHours, 0, 23) * 60 + clamp(newMinutes, 0, 59));
  }

  function stepHour(delta: number) {
    setHourDraft("");
    commit(wrap(hours, delta, 24), minutes);
  }

  function stepMinute(delta: number) {
    setMinuteDraft("");
    commit(hours, wrap(minutes, delta, 60));
  }

  function handleHourChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 2);
    if (digits === "") {
      setHourDraft("");
      return;
    }
    const asNum = Number(digits);
    // Two digits typed, or one digit that already rules out a valid second
    // one (e.g. "4" -- 40-49 are all out of range for an hour).
    if (digits.length === 2 || asNum * 10 > 23) {
      commit(clamp(asNum, 0, 23), minutes);
      setHourDraft("");
      minuteRef.current?.focus();
      minuteRef.current?.select();
    } else {
      setHourDraft(digits);
    }
  }

  function handleMinuteChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 2);
    if (digits === "") {
      setMinuteDraft("");
      return;
    }
    const asNum = Number(digits);
    if (digits.length === 2 || asNum * 10 > 59) {
      commit(hours, clamp(asNum, 0, 59));
      setMinuteDraft("");
    } else {
      setMinuteDraft(digits);
    }
  }

  function handleHourKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      stepHour(1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      stepHour(-1);
    } else if (event.key === "ArrowRight" && (event.currentTarget.selectionStart ?? 0) >= (hourDraft || pad2(hours)).length) {
      event.preventDefault();
      setHourDraft("");
      minuteRef.current?.focus();
      minuteRef.current?.select();
    } else if (!/[0-9]/.test(event.key) && !["Backspace", "Tab", "Delete", "ArrowLeft"].includes(event.key)) {
      event.preventDefault();
    }
  }

  function handleMinuteKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      stepMinute(1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      stepMinute(-1);
    } else if (event.key === "Backspace" && minuteDraft === "" && (event.currentTarget.selectionStart ?? 0) === 0) {
      event.preventDefault();
      hourRef.current?.focus();
      hourRef.current?.select();
    } else if (event.key === "ArrowLeft" && (event.currentTarget.selectionStart ?? 0) === 0) {
      event.preventDefault();
      hourRef.current?.focus();
      hourRef.current?.select();
    } else if (!/[0-9]/.test(event.key) && !["Backspace", "Tab", "Delete", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
    }
  }

  return (
    <div className={`time-field${compact ? " time-field-compact" : ""}`} ref={containerRef}>
      <div className="time-field-unit">
        <input
          ref={hourRef}
          id={id ? `${id}-hour` : undefined}
          className="time-field-segment"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={`${ariaLabel} — hours`}
          value={hourDraft || pad2(hours)}
          maxLength={2}
          onChange={handleHourChange}
          onKeyDown={handleHourKeyDown}
          onWheel={(e: WheelEvent<HTMLInputElement>) => {
            e.preventDefault();
            stepHour(e.deltaY < 0 ? 1 : -1);
          }}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => setHourDraft("")}
        />
      </div>
      <span className="time-field-colon" aria-hidden="true">
        :
      </span>
      <div className="time-field-unit">
        <input
          ref={minuteRef}
          id={id ? `${id}-minute` : undefined}
          className="time-field-segment"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={`${ariaLabel} — minutes`}
          value={minuteDraft || pad2(minutes)}
          maxLength={2}
          onChange={handleMinuteChange}
          onKeyDown={handleMinuteKeyDown}
          onWheel={(e: WheelEvent<HTMLInputElement>) => {
            e.preventDefault();
            stepMinute(e.deltaY < 0 ? 1 : -1);
          }}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => setMinuteDraft("")}
        />
      </div>
      <button
        type="button"
        className={`time-field-picker-btn${isOpen ? " is-open" : ""}`}
        aria-label={`${ariaLabel}: choose time`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        <ClockIcon />
      </button>

      {isOpen && (
        <div className="time-field-popover" role="menu" ref={popoverRef} style={popoverStyle}>
          <div className="time-field-popover-col">
            <div className="time-field-popover-heading">Hour</div>
            <div className="time-field-popover-list" ref={hourListRef}>
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  role="menuitemradio"
                  aria-checked={h === hours}
                  data-selected={h === hours ? "true" : undefined}
                  className={`time-field-popover-item${h === hours ? " is-selected" : ""}`}
                  onClick={() => commit(h, minutes)}
                >
                  {pad2(h)}
                </button>
              ))}
            </div>
          </div>
          <div className="time-field-popover-col">
            <div className="time-field-popover-heading">Min</div>
            <div className="time-field-popover-list" ref={minuteListRef}>
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="menuitemradio"
                  aria-checked={m === minutes}
                  data-selected={m === minutes ? "true" : undefined}
                  className={`time-field-popover-item${m === minutes ? " is-selected" : ""}`}
                  onClick={() => commit(hours, m)}
                >
                  {pad2(m)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
