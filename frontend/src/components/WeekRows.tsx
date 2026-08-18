import type { WorkSession } from "../types/WorkSession";
import { toISODate } from "../utils/dateUtils";
import { DayRow } from "./DayRow";

interface WeekRowsProps {
  weekDays: Date[];
  sessionsByDate: Record<string, WorkSession[]>;
  onAddClick: (dateIso: string, dateObj: Date, startTime?: string | null, endTime?: string | null) => void;
  onSessionClick: (session: WorkSession) => void;
  onSessionMove: (session: WorkSession, newStart: string, newEnd: string) => Promise<boolean>;
  onRemoveAllClick: (dateIso: string) => void;
}

export function WeekRows({ weekDays, sessionsByDate, ...callbacks }: WeekRowsProps) {
  return (
    <main className="week-rows">
      {weekDays.map((date, index) => (
        <DayRow
          key={toISODate(date)}
          date={date}
          sessions={sessionsByDate[toISODate(date)] ?? []}
          index={index}
          {...callbacks}
        />
      ))}
    </main>
  );
}
