import { generateAxisTicks, minutesToPercent } from "../utils/timelineLayout";

interface TimelineAxisProps {
  rangeStartMin: number;
  rangeEndMin: number;
}

// Ruler-style axis: major ticks (labeled, ~4 across the visible range) are
// taller and brighter than the minor ticks (at each major segment's
// midpoint), like a physical measuring instrument.
export function TimelineAxis({ rangeStartMin, rangeEndMin }: TimelineAxisProps) {
  const { majorMins, minorMins } = generateAxisTicks(rangeStartMin, rangeEndMin);

  return (
    <div className="timeline-axis">
      {minorMins.map((mins) => (
        <span
          key={`minor-${mins}`}
          className="axis-tick axis-tick-minor"
          style={{ left: `${minutesToPercent(mins, rangeStartMin, rangeEndMin)}%` }}
        />
      ))}
      {majorMins.map((mins) => {
        // The very first/last tick get their label anchored inward instead
        // of centered, so it can't spill outside the track.
        const labelClass = [
          "axis-tick-label",
          mins === rangeStartMin ? "axis-tick-label-start" : null,
          mins === rangeEndMin ? "axis-tick-label-end" : null,
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <span
            key={`major-${mins}`}
            className="axis-tick axis-tick-major"
            style={{ left: `${minutesToPercent(mins, rangeStartMin, rangeEndMin)}%` }}
          >
            <span className={labelClass}>
              {String(Math.floor(mins / 60)).padStart(2, "0")}:{String(mins % 60).padStart(2, "0")}
            </span>
          </span>
        );
      })}
    </div>
  );
}
