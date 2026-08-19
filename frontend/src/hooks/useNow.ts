import { useEffect, useState } from "react";
import { toISODate } from "../utils/dateUtils";

export interface Now {
  // Minutes since midnight, for positioning the live "now" line on a timebar.
  nowMinutes: number;
  todayIso: string;
}

function readNow(): Now {
  const now = new Date();
  return { nowMinutes: now.getHours() * 60 + now.getMinutes(), todayIso: toISODate(now) };
}

// Ticks once a minute -- the "now" line only ever moves in whole-minute
// steps, so anything finer would just be wasted re-renders. One shared clock
// for the whole week view (not one interval per day row).
export function useNow(): Now {
  const [now, setNow] = useState(readNow);
  useEffect(() => {
    const id = setInterval(() => setNow(readNow()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
