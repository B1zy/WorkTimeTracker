export type WorkLocation = "Remote" | "InOffice" | "Other";

// `date` is "YYYY-MM-DD", `start`/`end` are "HH:MM:SS" (matching the
// backend's DateOnly/TimeOnly serialization).
export interface WorkSession {
  id: number;
  name: string;
  description: string;
  location: WorkLocation;
  date: string;
  start: string;
  end: string;
}

export type NewWorkSession = Omit<WorkSession, "id">;
