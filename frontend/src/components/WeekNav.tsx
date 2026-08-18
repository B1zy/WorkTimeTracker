import { WeekPicker } from "./WeekPicker";

interface WeekNavProps {
  label: string;
  currentMonday: Date;
  onPrev: () => void;
  onNext: () => void;
  onSelectWeek: (monday: Date) => void;
}

export function WeekNav({ label, currentMonday, onPrev, onNext, onSelectWeek }: WeekNavProps) {
  return (
    <div className="week-nav">
      <button type="button" className="nav-btn" aria-label="Previous week" onClick={onPrev}>
        ‹
      </button>
      <WeekPicker label={label} currentMonday={currentMonday} onSelectWeek={onSelectWeek} />
      <button type="button" className="nav-btn" aria-label="Next week" onClick={onNext}>
        ›
      </button>
    </div>
  );
}
