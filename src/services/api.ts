/**
 * WhimsyMaya — Cloudflare Workers API Client Service
 * Communicates with Hono `/api/*` endpoints using HTTP-only SameSite cookies,
 * CSRF protection header (`X-Requested-With`), and in-memory session token support.
 */

let inMemorySessionToken: string | null = null;

export function setInMemorySessionToken(token: string | null) {
  inMemorySessionToken = token;
}

export function getInMemorySessionToken(): string | null {
  return inMemorySessionToken;
}

export async function apiRequest<T = Record<string, unknown>>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('X-Requested-With', 'WhimsyMaya-Client');

  if (inMemorySessionToken) {
    headers.set('Authorization', `Bearer ${inMemorySessionToken}`);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    if (contentType.includes('application/json')) {
      const errData = (await response.json()) as { error?: string };
      throw new Error(errData.error || `Request failed with status ${response.status}`);
    }
    throw new Error(`Request failed with status ${response.status}`);
  }

  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return undefined as unknown as T;
}
