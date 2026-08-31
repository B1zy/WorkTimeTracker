// Wrapper around the backend's fetch calls.
// Every function returns a Promise that resolves with parsed JSON (or nothing
// for 204 responses), or throws an Error with a readable message if the
// request failed.

import type { NewWorkSession, WorkSession } from "../types/WorkSession";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5149/api/WorkSessions";

// Shared helper: runs fetch, then checks the response status.
// The backend doesn't always send a JSON body (e.g. 204 No Content on
// PUT/DELETE), so we only try to parse JSON when there's something to parse.
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // Try to read an error message from the body, but don't blow up if there isn't one.
    const text = await response.text().catch(() => "");
    throw new Error(`API request failed (${response.status} ${response.statusText}): ${text}`);
  }

  if (response.status === 204) {
    return null as T; // No Content
  }

  return response.json();
}

// GET /api/WorkSessions?startDate=...&endDate=...
export async function getSessions(startDate: string, endDate: string): Promise<WorkSession[]> {
  const url = `${BASE_URL}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  const response = await fetch(url);
  return handleResponse<WorkSession[]>(response);
}

// Every session, regardless of date. The backend has no "all" endpoint, so
// this is the range query with bounds wide enough to cover anything real.
export async function getAllSessions(): Promise<WorkSession[]> {
  return getSessions("1970-01-01", "2999-12-31");
}

// GET /api/WorkSessions/{id}
export async function getSessionById(id: number): Promise<WorkSession> {
  const response = await fetch(`${BASE_URL}/${id}`);
  return handleResponse<WorkSession>(response);
}

// POST /api/WorkSessions (session should NOT include an id)
export async function createSession(session: NewWorkSession): Promise<WorkSession> {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session),
  });
  return handleResponse<WorkSession>(response);
}

// PUT /api/WorkSessions/{id} (session must include the id)
export async function updateSession(id: number, session: WorkSession): Promise<void> {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session),
  });
  return handleResponse<void>(response);
}

// DELETE /api/WorkSessions/{id}
export async function deleteSession(id: number): Promise<void> {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: "DELETE",
  });
  return handleResponse<void>(response);
}
