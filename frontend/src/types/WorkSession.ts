export type WorkLocation = "Remote" | "InOffice" | "Other";

export type EntryType = "Working" | "Sick" | "OvertimeCompensation" | "Appointment" | "Lunch" | "Vacation";

// `date` is "YYYY-MM-DD", `start`/`end` are "HH:MM:SS" (matching the
// backend's DateOnly/TimeOnly serialization).
export interface WorkSession {
  id: number;
  name: string;
  description: string;
  location: WorkLocation;
  entryType: EntryType;
  date: string;
  start: string;
  end: string;
}

export type NewWorkSession = Omit<WorkSession, "id">;
