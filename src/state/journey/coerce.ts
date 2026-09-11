/**
 * Coercion primitives for the persistence boundary.
 *
 * The project validates persisted shapes by hand rather than with a schema
 * library — see the note at the top of server/src/validate.js, and `migrate()`
 * in state/defaults.ts. These helpers keep that approach honest: every reader
 * below takes `unknown` and returns a definite value, so a partial, corrupt or
 * future-version payload degrades to defaults instead of reaching a screen.
 *
 * The rule throughout: never throw, never trust, always return something
 * renderable. A user whose stored file lost one field keeps the other ten.
 */

export function asString(value: unknown, fallback = '', max = 2000): string {
  if (typeof value !== 'string') return fallback;
  return value.length > max ? value.slice(0, max) : value;
}

export function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Tri-state Done boxes: anything that is not a real boolean is "unanswered". */
export function asNullableBool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

/**
 * Finite numbers only — `NaN` and `Infinity` are what a bad parse produces,
 * and either one poisons a chart axis for every other point on it.
 */
export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** A nullable number constrained to a sane range; out-of-range becomes null. */
export function asBoundedNumber(value: unknown, min: number, max: number): number | null {
  const n = asNullableNumber(value);
  if (n === null) return null;
  return n >= min && n <= max ? n : null;
}

export function asPositiveInt(value: unknown, fallback: number | null = null): number | null {
  const n = asNullableNumber(value);
  if (n === null) return fallback;
  const rounded = Math.round(n);
  return rounded > 0 ? rounded : fallback;
}

/** Narrows to a member of a closed set, falling back when the value is unknown. */
export function asEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** Same, but an unrecognised value yields null rather than a default. */
export function asOptionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Maps an unknown array through a reader, dropping anything the reader
 * rejects. One malformed row is skipped; the rest of the list survives.
 */
export function asArray<T>(
  value: unknown,
  read: (item: unknown) => T | null,
  max = 5000,
): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const item of value) {
    if (out.length >= max) break;
    const parsed = read(item);
    if (parsed !== null) out.push(parsed);
  }
  return out;
}

/** Matches `dayKey()` in lib/time: a local-time YYYY-MM-DD. */
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDayKey(value: unknown): value is string {
  return typeof value === 'string' && DAY_KEY_RE.test(value);
}

export function asDayKey(value: unknown): string | null {
  return isDayKey(value) ? value : null;
}
