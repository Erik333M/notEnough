/**
 * Success Journey persistence boundary.
 *
 * `migrateJourney()` is the *only* way this slice enters the app. It is total:
 * every input — undefined (a client older than the feature), a v1 payload, a
 * v3 payload written by a future build, or corrupt JSON — produces a valid
 * `JourneyState`. Nothing downstream re-validates, because nothing downstream
 * has to.
 *
 * Adding a version:
 *  1. bump JOURNEY_SCHEMA_VERSION
 *  2. add a `case` to `upgrade()` that transforms the previous shape
 *  3. leave the readers alone unless a field's *type* changed
 * Versions run in sequence, so a v1 payload upgrades 1→2→3 rather than needing
 * a bespoke 1→3 path.
 */

import { asEnum, asNumber, isRecord } from './coerce';
import { createJourneyState, emptyBaseline } from './factory';
import { readEntries } from './entryReaders';
import {
  readBaseline,
  readBenchmarkDefinition,
  readBenchmarkResult,
  readChecks,
  readHabit,
  readMeasurement,
  readMovement,
} from './readers';
import type { JourneyState, UnitSystem } from './types';

export const JOURNEY_SCHEMA_VERSION = 1;

const UNIT_SYSTEMS: readonly UnitSystem[] = ['metric', 'imperial'];

/**
 * Caps. Chosen well above any realistic use (ten years of daily entries, a
 * decade of weekly measurements) purely so a corrupt or hostile payload cannot
 * make the app allocate without bound on launch.
 */
const LIMITS = {
  entries: 4000,
  movements: 500,
  benchmarks: 300,
  results: 5000,
  measurements: 5000,
  habits: 200,
} as const;

/** Reads whatever version the payload claims, defaulting to the oldest. */
function storedVersion(raw: Record<string, unknown>): number {
  const version = asNumber(raw.schemaVersion, 1);
  return version >= 1 ? Math.floor(version) : 1;
}

/**
 * Sequential per-version transforms.
 *
 * Empty at v1 — there is no earlier shape to upgrade from. It exists now so
 * that the first migration is a three-line diff rather than a refactor, which
 * is the whole point of shipping a migration path from day one.
 */
function upgrade(state: JourneyState, from: number): JourneyState {
  let next = state;
  for (let version = from; version < JOURNEY_SCHEMA_VERSION; version += 1) {
    switch (version) {
      // case 1: next = { ...next, someNewField: default }; break;
      default:
        break;
    }
  }
  return { ...next, schemaVersion: JOURNEY_SCHEMA_VERSION };
}

/**
 * Truncates a day-keyed record to its most recent `max` days.
 *
 * Sorting lexicographically is sound because `YYYY-MM-DD` sorts
 * chronologically as text — the reason that key format was chosen.
 */
function capDays<T>(record: Record<string, T>, max: number): Record<string, T> {
  const keys = Object.keys(record);
  if (keys.length <= max) return record;

  const kept = keys.sort().slice(-max);
  const out: Record<string, T> = {};
  for (const key of kept) out[key] = record[key];
  return out;
}

/**
 * Turns anything at all into a valid slice.
 *
 * A missing payload is a *new* slice, not an error: that is the upgrade path
 * for every account that existed before this feature shipped.
 */
export function migrateJourney(raw: unknown): JourneyState {
  const fresh = createJourneyState(JOURNEY_SCHEMA_VERSION);
  if (!isRecord(raw)) return fresh;

  const from = storedVersion(raw);

  const parsed: JourneyState = {
    schemaVersion: from,
    entries: capDays(readEntries(raw.entries), LIMITS.entries),
    movements: mapRows(raw.movements, readMovement, LIMITS.movements),
    benchmarks: mapRows(raw.benchmarks, readBenchmarkDefinition, LIMITS.benchmarks),
    results: mapRows(raw.results, readBenchmarkResult, LIMITS.results),
    baseline: raw.baseline === undefined ? emptyBaseline() : readBaseline(raw.baseline),
    measurements: mapRows(raw.measurements, readMeasurement, LIMITS.measurements),
    habits: mapRows(raw.habits, readHabit, LIMITS.habits),
    checks: capDays(readChecks(raw.checks), LIMITS.entries),
    units: asEnum(raw.units, UNIT_SYSTEMS, 'metric'),
  };

  // A payload from a *newer* build is read with this build's readers, which
  // drop fields it does not know. Better a usable subset than a blank slate:
  // the unknown fields are already lost either way, and refusing the whole
  // payload would throw away the user's history with them.
  return upgrade(parsed, from);
}

/** Keeps the newest rows when a list is over its cap. */
function mapRows<T>(value: unknown, read: (item: unknown) => T | null, max: number): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const item of value) {
    const parsed = read(item);
    if (parsed !== null) out.push(parsed);
  }
  return out.length > max ? out.slice(-max) : out;
}
