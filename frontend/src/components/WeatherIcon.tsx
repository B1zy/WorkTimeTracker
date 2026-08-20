import type { WeatherIconKind } from "../utils/weather";

interface WeatherIconProps {
  kind: WeatherIconKind;
  size?: number;
}

// One rounded cloud outline shared by every cloud-based icon below, stroked
// (not filled) to match the rest of the app's icon language (see TimeField's
// ClockIcon) -- keeps overlapping compositions like "partly-cloudy" legible
// without needing real occlusion between shapes.
const CLOUD_PATH = "M4.8 12.3a2.5 2.5 0 0 1 .3-5 3.6 3.6 0 0 1 6.9-1.15A2.9 2.9 0 0 1 11.6 12.3H4.8Z";

function Cloud() {
  return <path d={CLOUD_PATH} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />;
}

function Sun({ cx = 8, cy = 8, r = 3.1, rays = 8 }: { cx?: number; cy?: number; r?: number; rays?: number }) {
  const angles = Array.from({ length: rays }, (_, i) => (i * 360) / rays);
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="1.2" />
      {angles.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = cx + Math.sin(rad) * (r + 1.1);
        const y1 = cy - Math.cos(rad) * (r + 1.1);
        const x2 = cx + Math.sin(rad) * (r + 2.4);
        const y2 = cy - Math.cos(rad) * (r + 2.4);
        return (
          <line
            key={deg}
            x1={x1.toFixed(2)}
            y1={y1.toFixed(2)}
            x2={x2.toFixed(2)}
            y2={y2.toFixed(2)}
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        );
      })}
    </>
  );
}

function RainDrops({ dashed = false }: { dashed?: boolean }) {
  return (
    <>
      {[5.4, 8, 10.6].map((x, i) => (
        <line
          key={x}
          x1={x}
          y1={13.1 + (i % 2 === 0 ? 0 : 0.4)}
          x2={x - (dashed ? 0 : 0.9)}
          y2={15 + (i % 2 === 0 ? 0 : 0.4)}
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeDasharray={dashed ? "0.4 1.1" : undefined}
        />
      ))}
    </>
  );
}

function SnowFlakes() {
  return (
    <>
      {[5.4, 8, 10.6].map((x, i) => (
        <circle key={x} cx={x} cy={13.8 + (i % 2 === 0 ? 0 : 0.6)} r="0.55" fill="currentColor" stroke="none" />
      ))}
    </>
  );
}

function Bolt() {
  return (
    <path
      d="M9 12 6.7 15.3h1.6l-1.1 2 3.1-3.7h-1.7L9 12Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="0.4"
      strokeLinejoin="round"
    />
  );
}

function FogLines() {
  return (
    <>
      <line x1="3" y1="5.5" x2="13" y2="5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="3.8" y1="8" x2="12.2" y2="8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="3" y1="10.5" x2="13" y2="10.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </>
  );
}

export function WeatherIcon({ kind, size = 14 }: WeatherIconProps) {
  return (
    <svg viewBox="0 0 16 18" width={size} height={size} aria-hidden="true" focusable="false">
      {kind === "clear" && <Sun />}
      {kind === "partly-cloudy" && (
        <>
          <Sun cx={11} cy={5} r={2} rays={5} />
          <Cloud />
        </>
      )}
      {kind === "cloudy" && <Cloud />}
      {kind === "fog" && <FogLines />}
      {kind === "drizzle" && (
        <>
          <Cloud />
          <RainDrops dashed />
        </>
      )}
      {kind === "rain" && (
        <>
          <Cloud />
          <RainDrops />
        </>
      )}
      {kind === "snow" && (
        <>
          <Cloud />
          <SnowFlakes />
        </>
      )}
      {kind === "thunderstorm" && (
        <>
          <Cloud />
          <Bolt />
        </>
      )}
    </svg>
  );
}
