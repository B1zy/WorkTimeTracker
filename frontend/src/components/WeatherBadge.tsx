import { useEffect, useRef, useState } from "react";
import { weatherCodeLabel, weatherIconKind, type DayWeather } from "../utils/weather";
import { WeatherIcon } from "./WeatherIcon";

interface WeatherBadgeProps {
  day: DayWeather | undefined;
  weekdayLabel: string;
  dateLabel: string;
}

function formatTemp(celsius: number): string {
  return `${Math.round(celsius)}°`;
}

// Every third hour (00, 03, 06, ...) -- a full 24-entry hourly strip would be
// too dense for a small popover; this still shows the shape of the day.
function sampleHours(hours: DayWeather["hours"]) {
  return hours.filter((h) => h.hour % 3 === 0).sort((a, b) => a.hour - b.hour);
}

// Sits next to the weekday label in DayRow's header. Renders nothing when
// there's no data for this date (outside the forecast/archive window, or
// weather hasn't loaded/isn't configured) -- a blank space there reads as
// "no weather available" rather than a broken control.
export function WeatherBadge({ day, weekdayLabel, dateLabel }: WeatherBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  if (!day) return null;

  const kind = weatherIconKind(day.code);
  const label = weatherCodeLabel(day.code);
  const hours = sampleHours(day.hours);

  return (
    <div className="weather-badge" ref={containerRef}>
      <button
        type="button"
        className={`weather-badge-btn${isOpen ? " is-open" : ""}`}
        aria-label={`Weather for ${weekdayLabel}: ${label}, high ${formatTemp(day.tempMaxC)}, low ${formatTemp(day.tempMinC)}. Click for details.`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="weather-badge-icon">
          <WeatherIcon kind={kind} />
        </span>
        <span className="weather-badge-temp">{formatTemp(day.tempMaxC)}</span>
      </button>

      {isOpen && (
        <div className="weather-popover" role="dialog" aria-label={`Weather details for ${dateLabel}`}>
          <div className="weather-popover-header">
            <span className="weather-popover-icon">
              <WeatherIcon kind={kind} size={26} />
            </span>
            <div>
              <div className="weather-popover-condition">{label}</div>
              <div className="weather-popover-date">{dateLabel}</div>
            </div>
          </div>

          <div className="weather-popover-stats">
            <div className="weather-popover-stat">
              <span className="weather-popover-stat-label">High</span>
              <span>{formatTemp(day.tempMaxC)}</span>
            </div>
            <div className="weather-popover-stat">
              <span className="weather-popover-stat-label">Low</span>
              <span>{formatTemp(day.tempMinC)}</span>
            </div>
            <div className="weather-popover-stat">
              <span className="weather-popover-stat-label">Precip</span>
              <span>{day.precipitationSumMm.toFixed(1)} mm</span>
            </div>
            <div className="weather-popover-stat">
              <span className="weather-popover-stat-label">Wind</span>
              <span>{Math.round(day.windMaxKmh)} km/h</span>
            </div>
          </div>

          {hours.length > 0 && (
            <div className="weather-popover-hours">
              {hours.map((h) => (
                <div key={h.hour} className="weather-popover-hour">
                  <span className="weather-popover-hour-time">{String(h.hour).padStart(2, "0")}</span>
                  <WeatherIcon kind={weatherIconKind(h.code)} size={15} />
                  <span className="weather-popover-hour-temp">{formatTemp(h.tempC)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
