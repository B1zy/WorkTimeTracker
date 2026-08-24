// Copy/paste glyphs for DayRow's action row, in the same stroke-only icon
// language as WeatherIcon/ClockIcon (currentColor, no fill) -- overlapping
// shapes read fine without real occlusion, same as WeatherIcon's compositions.

interface DayActionIconProps {
  size?: number;
}

export function CopyIcon({ size = 13 }: DayActionIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="8" height="8" rx="1.3" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="6" y="6" width="8" height="8" rx="1.3" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function PasteIcon({ size = 13 }: DayActionIconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" focusable="false">
      <rect x="3" y="3.5" width="10" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="6" y="2" width="4" height="2.4" rx="0.8" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <line x1="5.3" y1="8" x2="10.7" y2="8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="5.3" y1="10.6" x2="10.7" y2="10.6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
