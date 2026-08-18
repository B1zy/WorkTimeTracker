import { useEffect, useRef, useState } from "react";
import { addMonths, buildMonthGrid, formatMonthLabel } from "../utils/calendar";
import { getMonday, toISODate } from "../utils/dateUtils";

interface WeekPickerProps {
  label: string;
  currentMonday: Date;
  onSelectWeek: (monday: Date) => void;
}

const WEEKDAY_HEADERS = ["M", "T", "W", "T", "F", "S", "S"];

export function WeekPicker({ label, currentMonday, onSelectWeek }: WeekPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(currentMonday);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) setViewMonth(currentMonday);
  }, [isOpen, currentMonday]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const days = buildMonthGrid(viewMonth);
  const viewMonthIndex = viewMonth.getMonth();
  const currentWeekMondayIso = toISODate(currentMonday);
  const todayIso = toISODate(new Date());

  function handlePick(day: Date) {
    onSelectWeek(getMonday(day));
    setIsOpen(false);
  }

  function handleToday() {
    onSelectWeek(getMonday(new Date()));
    setIsOpen(false);
  }

  return (
    <div className="week-picker" ref={containerRef}>
      <button
        type="button"
        className={`week-range-btn${isOpen ? " is-open" : ""}`}
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Choose week"
        title="Choose week"
      >
        {label}
      </button>

      {isOpen && (
        <div className="week-picker-popover" role="dialog" aria-label="Choose a week">
          <div className="week-picker-month-nav">
            <button
              type="button"
              className="nav-btn nav-btn-small"
              aria-label="Previous month"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
            >
              ‹
            </button>
            <span className="week-picker-month-label">{formatMonthLabel(viewMonth)}</span>
            <button
              type="button"
              className="nav-btn nav-btn-small"
              aria-label="Next month"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
            >
              ›
            </button>
          </div>

          <div className="week-picker-grid">
            {WEEKDAY_HEADERS.map((d, i) => (
              <div key={i} className="week-picker-weekday">
                {d}
              </div>
            ))}
            {days.map((day, i) => {
              const iso = toISODate(day);
              const weekMonday = days[Math.floor(i / 7) * 7];
              const isSelectedWeek = toISODate(weekMonday) === currentWeekMondayIso;
              const dayOfWeek = i % 7;
              const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
              const classes = [
                "week-picker-day",
                day.getMonth() !== viewMonthIndex ? "is-outside" : "",
                isSelectedWeek && !isWeekend ? "is-selected-workday" : "",
                isSelectedWeek && dayOfWeek === 0 ? "is-week-start" : "",
                isSelectedWeek && dayOfWeek === 4 ? "is-week-end" : "",
                iso === todayIso ? "is-today" : "",
                isWeekend ? "is-weekend" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button key={iso} type="button" className={classes} onClick={() => handlePick(day)}>
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <button type="button" className="week-picker-today-btn" onClick={handleToday}>
            This week
          </button>
        </div>
      )}
    </div>
  );
}
