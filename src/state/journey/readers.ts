/**
 * `unknown` -> domain shape readers for the catalogue and log shapes.
 *
 * Every value that arrives from disk or the server passes through here before
 * anything renders it. These readers return `T | null` and reject the row
 * outright — a movement with no name is not a movement, and a benchmark result
 * with no date can never be plotted. Daily entries repair rather than reject,
 * so they live in entryReaders.ts.
 */

import { makeId } from '../../lib/crypto';
import {
  asArray,
  asBool,
  asBoundedNumber,
  asDayKey,
  asEnum,
  asNullableNumber,
  asNumber,
  asString,
  isRecord,
} from './coerce';
import { BOUNDS } from './bounds';
import { HABIT_GROUPS, MOVEMENT_CATEGORIES, emptyBaseline } from './factory';
import { LINE_MAX, NOTE_MAX } from './limits';
import type {
  BenchmarkDefinition,
  BenchmarkGroup,
  BenchmarkMetric,
  BenchmarkResult,
  Habit,
  HabitChecks,
  MeasurementBaseline,
  MeasurementEntry,
  Movement,
} from './types';

/* ---------------------------------------------------------------- movements */

export function readMovement(value: unknown): Movement | null {
  if (!isRecord(value)) return null;
  const name = asString(value.name, '', LINE_MAX).trim();
  if (!name) return null;

  return {
    id: asString(value.id, '', 64) || makeId(),
    name,
    category: asEnum(value.category, MOVEMENT_CATEGORIES, 'strength'),
    aliases: asArray(value.aliases, (a) => (typeof a === 'string' && a.trim() ? a.trim() : null), 12),
    // Anything persisted in state is by definition custom; seeds are merged
    // from JSON at read time and never written here.
    isCustom: true,
  };
}

/* --------------------------------------------------------------- benchmarks */

const BENCHMARK_GROUPS: readonly BenchmarkGroup[] = [
  'monostructural',
  'gymnastics',
  'weightlifting',
];

const BENCHMARK_METRICS: readonly BenchmarkMetric[] = ['time', 'duration', 'reps', 'weight'];

export function readBenchmarkDefinition(value: unknown): BenchmarkDefinition | null {
  if (!isRecord(value)) return null;
  const name = asString(value.name, '', LINE_MAX).trim();
  if (!name) return null;

  return {
    id: asString(value.id, '', 64) || makeId(),
    name,
    group: asEnum(value.group, BENCHMARK_GROUPS, 'weightlifting'),
    metric: asEnum(value.metric, BENCHMARK_METRICS, 'reps'),
    isCustom: true,
  };
}

export function readBenchmarkResult(value: unknown): BenchmarkResult | null {
  if (!isRecord(value)) return null;
  const date = asDayKey(value.date);
  const definitionId = asString(value.definitionId, '', 64);
  const score = asNullableNumber(value.value);
  // A result with no date, no test or no number cannot be plotted or compared.
  if (!date || !definitionId || score === null || score < 0) return null;

  return {
    id: asString(value.id, '', 64) || makeId(),
    definitionId,
    date,
    value: score,
    notes: asString(value.notes, '', NOTE_MAX),
  };
}

/* ------------------------------------------------------------- measurements */

export function readBaseline(value: unknown): MeasurementBaseline {
  if (!isRecord(value)) return emptyBaseline();
  return {
    heightCm: asBoundedNumber(value.heightCm, ...BOUNDS.heightCm),
    currentWeightKg: asBoundedNumber(value.currentWeightKg, ...BOUNDS.currentWeightKg),
    targetWeightKg: asBoundedNumber(value.targetWeightKg, ...BOUNDS.targetWeightKg),
    restingHeartRate: asBoundedNumber(value.restingHeartRate, ...BOUNDS.restingHeartRate),
    referenceHeartRate: asBoundedNumber(value.referenceHeartRate, ...BOUNDS.referenceHeartRate),
  };
}

export function readMeasurement(value: unknown): MeasurementEntry | null {
  if (!isRecord(value)) return null;
  const date = asDayKey(value.date);
  if (!date) return null;

  return {
    id: asString(value.id, '', 64) || makeId(),
    date,
    weightKg: asBoundedNumber(value.weightKg, ...BOUNDS.weightKg),
    bodyFatPct: asBoundedNumber(value.bodyFatPct, ...BOUNDS.bodyFatPct),
    waterPct: asBoundedNumber(value.waterPct, ...BOUNDS.waterPct),
    musclePct: asBoundedNumber(value.musclePct, ...BOUNDS.musclePct),
    heartRateBefore: asBoundedNumber(value.heartRateBefore, ...BOUNDS.heartRateBefore),
    heartRateAfter: asBoundedNumber(value.heartRateAfter, ...BOUNDS.heartRateAfter),
    recoverySeconds: asBoundedNumber(value.recoverySeconds, ...BOUNDS.recoverySeconds),
    workoutsPerWeek: asBoundedNumber(value.workoutsPerWeek, ...BOUNDS.workoutsPerWeek),
  };
}

/* ------------------------------------------------------------------- habits */

export function readHabit(value: unknown): Habit | null {
  if (!isRecord(value)) return null;
  const title = asString(value.title, '', LINE_MAX).trim();
  if (!title) return null;

  return {
    id: asString(value.id, '', 64) || makeId(),
    templateId: asString(value.templateId, '', 64) || null,
    title,
    group: asEnum(value.group, HABIT_GROUPS, 'health'),
    createdAt: asNumber(value.createdAt, 0),
    archived: asBool(value.archived),
  };
}

/** Only `true` ticks survive, so the map never fills with explicit falses. */
export function readChecks(value: unknown): HabitChecks {
  const out: HabitChecks = {};
  if (!isRecord(value)) return out;

  for (const [day, stored] of Object.entries(value)) {
    if (asDayKey(day) === null || !isRecord(stored)) continue;
    const ticks: Record<string, boolean> = {};
    for (const [habitId, done] of Object.entries(stored)) {
      if (done === true) ticks[habitId] = true;
    }
    if (Object.keys(ticks).length > 0) out[day] = ticks;
  }
  return out;
}
