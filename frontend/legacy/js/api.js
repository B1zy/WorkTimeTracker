// Wrapper around the backend's fetch calls.
// Every function returns a Promise that resolves with parsed JSON (or nothing
// for 204 responses), or throws an Error with a readable message if the
// request failed.

const BASE_URL = "http://localhost:5149/api/WorkSessions";

// Shared helper: runs fetch, then checks the response status.
// The backend doesn't always send a JSON body (e.g. 204 No Content on
// PUT/DELETE), so we only try to parse JSON when there's something to parse.
async function handleResponse(response) {
  if (!response.ok) {
    // Try to read an error message from the body, but don't blow up if there isn't one.
    const text = await response.text().catch(() => "");
    throw new Error(`API request failed (${response.status} ${response.statusText}): ${text}`);
  }

  if (response.status === 204) {
    return null; // No Content
  }

  return response.json();
}

// GET /api/WorkSessions?startDate=...&endDate=...
export async function getSessions(startDate, endDate) {
  const url = `${BASE_URL}?startDate=${startDate}&endDate=${endDate}`;
  const response = await fetch(url);
  return handleResponse(response);
}

// GET /api/WorkSessions/{id}
export async function getSessionById(id) {
  const response = await fetch(`${BASE_URL}/${id}`);
  return handleResponse(response);
}

// POST /api/WorkSessions (session should NOT include an id)
export async function createSession(session) {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session),
  });
  return handleResponse(response);
}

// PUT /api/WorkSessions/{id} (session must include the id)
export async function updateSession(id, session) {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session),
  });
  return handleResponse(response);
}

// DELETE /api/WorkSessions/{id}
export async function deleteSession(id) {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: "DELETE",
  });
  return handleResponse(response);
}
