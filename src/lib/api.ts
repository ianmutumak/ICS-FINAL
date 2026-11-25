/** A failed request to the server, with a message that is safe to show to the person using the app. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized: (() => void) | null = null;
let expectedUser = '';

/** The account this tab is showing. The server refuses requests if the browser's session now belongs to someone else. */
export function setExpectedUser(id: string) {
  expectedUser = id;
}

/** Called when the server says the session has ended (for example, the account was suspended). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export async function api<T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(expectedUser ? { 'X-Expected-User': expectedUser } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // A non-JSON reply (for example from a proxy) is reported generically below.
  }

  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error
      ?? (response.status >= 500 ? 'The server is not responding. Try again in a moment.' : 'The request failed.');
    // A wrong PIN is also a 401; only an ended session should sign the person out.
    if (response.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/pin')) onUnauthorized?.();
    throw new ApiError(response.status, message);
  }
  return data as T;
}

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong.');
