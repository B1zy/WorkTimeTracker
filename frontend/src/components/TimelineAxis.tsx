import { MAJOR_HOURS, MINOR_HOURS, minutesToPercent } from "../utils/timelineLayout";

// Ruler-style axis: major ticks (labeled, every 6h) are taller and brighter
// than the minor ticks (every 3h), like a physical measuring instrument.
export function TimelineAxis() {
  return (
    <div className="timeline-axis">
      {MINOR_HOURS.map((hour) => (
        <span
          key={`minor-${hour}`}
          className="axis-tick axis-tick-minor"
          style={{ left: `${minutesToPercent(hour * 60)}%` }}
        />
      ))}
      {MAJOR_HOURS.map((hour) => {
        // "24:00" (rather than wrapping to "00:00") so the ruler's end
        // doesn't look like a second copy of its start.
        const labelClass = [
          "axis-tick-label",
          hour === 0 ? "axis-tick-label-start" : null,
          hour === 24 ? "axis-tick-label-end" : null,
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <span
            key={`major-${hour}`}
            className="axis-tick axis-tick-major"
            style={{ left: `${minutesToPercent(hour * 60)}%` }}
          >
            <span className={labelClass}>{String(hour).padStart(2, "0")}:00</span>
          </span>
        );
      })}
    </div>
  );
}
