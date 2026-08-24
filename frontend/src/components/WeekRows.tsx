import type { WorkSession } from "../types/WorkSession";
import { toISODate } from "../utils/dateUtils";
import { useNow } from "../hooks/useNow";
import { DayRow } from "./DayRow";

interface WeekRowsProps {
  weekDays: Date[];
  sessionsByDate: Record<string, WorkSession[]>;
  onAddClick: (dateIso: string, dateObj: Date, startTime?: string | null, endTime?: string | null) => void;
  onSessionClick: (session: WorkSession) => void;
  onSessionMove: (session: WorkSession, newStart: string, newEnd: string) => Promise<boolean>;
  onRemoveAllClick: (dateIso: string) => void;
  onCopyClick: (dateIso: string) => void;
  onPasteClick: (dateIso: string) => void;
  hasClipboard: boolean;
}

export function WeekRows({ weekDays, sessionsByDate, ...callbacks }: WeekRowsProps) {
  // One shared live clock for the whole week, rather than one timer per day
  // row -- only the row matching todayIso ever uses nowMinutes.
  const { nowMinutes, todayIso } = useNow();

  return (
    <main className="week-rows">
      {weekDays.map((date, index) => {
        const iso = toISODate(date);
        return (
          <DayRow
            key={iso}
            date={date}
            sessions={sessionsByDate[iso] ?? []}
            index={index}
            isToday={iso === todayIso}
            nowMinutes={nowMinutes}
            {...callbacks}
          />
        );
      })}
    </main>
  );
}
