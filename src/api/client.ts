import Constants from 'expo-constants';

/**
 * Typed HTTP client for the NOTenough API.
 *
 * Every call resolves to a discriminated result instead of throwing, so callers
 * are forced to handle the offline case — which on mobile is the normal case,
 * not the exception.
 */

/**
 * 4000 is the most contested port on a dev machine — plenty of unrelated
 * projects grab it, and when one already holds it this server fails to bind
 * while the app happily talks to whatever *is* listening. That misfires as a
 * confusing CORS error rather than "connection refused", so the default is
 * deliberately off the beaten track. Override with EXPO_PUBLIC_API_URL.
 */
const DEFAULT_PORT = 4137;
const TIMEOUT_MS = 8000;

/**
 * Resolving the host is the one genuinely fiddly part of running a local API
 * against a real phone: `localhost` on the device means the device itself.
 *
 * Order: explicit env var → the LAN address Metro is already serving from
 * (which is by definition reachable from the phone) → localhost for simulators.
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:${DEFAULT_PORT}`;

  return `http://localhost:${DEFAULT_PORT}`;
}

export const API_BASE_URL = resolveBaseUrl();

export type ApiError = {
  /** `offline` means the request never reached the server. */
  kind: 'offline' | 'http';
  status: number;
  code: string;
  message: string;
  /** Set when the server blamed a specific input. */
  field?: 'name' | 'email' | 'password';
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  timeoutMs?: number;
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { method = 'GET', body, token, timeoutMs = TIMEOUT_MS } = options;

  // A hung socket must not hang the UI: abort well before the OS would.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text ? safeParse(text) : null;

    if (!response.ok) {
      return {
        ok: false,
        error: {
          kind: 'http',
          status: response.status,
          code: payload?.error ?? 'http_error',
          message: payload?.message ?? `Request failed (${response.status}).`,
          field: payload?.field,
        },
      };
    }

    return { ok: true, data: (payload ?? {}) as T };
  } catch {
    return {
      ok: false,
      error: {
        kind: 'offline',
        status: 0,
        code: 'offline',
        /*
         * Names the address, because "cannot reach the server" is true and
         * useless. This app is local-first: goals, the journey and victories
         * all keep working from the device, so when the API is down the only
         * thing that breaks is the half that needs it — teams, events,
         * friends. That reads as "events are broken" rather than "the server
         * is off", and the message was doing nothing to correct it.
         */
        message: `Cannot reach the server at ${API_BASE_URL}.`,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

function safeParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------- endpoints */

export type ApiUser = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

export type AuthResponse = { token: string; user: ApiUser };

export type RemoteState = {
  version: number;
  goals: unknown[];
  log: Record<string, Record<string, number>>;
  runs: unknown[];
  plan: Record<string, unknown>;
  victories: unknown;
  journey: unknown;
  updatedAt: number;
};

/**
 * Is the server there at all?
 *
 * A short timeout on purpose: this answers "is it up", and somebody pressing
 * a Check button wants a verdict rather than a spinner. Health needs no
 * token, so a `true` here means reachable, not signed in.
 */
export async function pingApi(): Promise<boolean> {
  const result = await request<{ ok: boolean }>('/api/health', { timeoutMs: 4000 });
  return result.ok;
}

export const api = {
  health: () => request<{ ok: boolean }>('/api/health', { timeoutMs: 3000 }),

  register: (name: string, email: string, password: string) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: { name, email, password },
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: { email, password } }),

  me: (token: string) => request<{ user: ApiUser }>('/api/auth/me', { token }),

  updateName: (token: string, name: string) =>
    request<{ user: ApiUser }>('/api/auth/me', { method: 'PATCH', token, body: { name } }),

  deleteAccount: (token: string) => request<null>('/api/auth/me', { method: 'DELETE', token }),

  pullState: (token: string) => request<{ state: RemoteState | null }>('/api/state', { token }),

  pushState: (token: string, state: Omit<RemoteState, 'updatedAt'> & { updatedAt: number }) =>
    request<{ state: RemoteState }>('/api/state', { method: 'PUT', token, body: state }),
};
