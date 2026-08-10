import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Thin typed wrapper over AsyncStorage.
 *
 * `writeJSON` is deliberately *not* awaited by callers on the hot path — UI state
 * is the source of truth during a session and persistence is a background echo.
 * `queueWrite` coalesces bursts (e.g. dragging a stepper) into one disk write.
 */

export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage failures must never crash the UI.
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

const pending = new Map<string, unknown>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced write — last value per key wins, flushed together. */
export function queueWrite(key: string, value: unknown, delay = 450): void {
  pending.set(key, value);
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushWrites, delay);
}

export async function flushWrites(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pending.size === 0) return;
  const entries: [string, string][] = [];
  for (const [key, value] of pending) {
    try {
      entries.push([key, JSON.stringify(value)]);
    } catch {
      /* skip unserializable */
    }
  }
  pending.clear();
  try {
    await AsyncStorage.multiSet(entries);
  } catch {
    /* noop */
  }
}

export const storageKeys = {
  /** Bearer token — SecureStore on device, never AsyncStorage on native. */
  token: 'ne.token.v1',
  /** Last known profile, so the app can open offline without a round trip. */
  cachedUser: 'ne.user.v1',
  appState: (userId: string) => `ne.state.v2.${userId}`,
  /** Server `updatedAt` we last reconciled with, per user. */
  syncStamp: (userId: string) => `ne.sync.v1.${userId}`,
} as const;
