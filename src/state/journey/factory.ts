import { NO_MUSCLE_WORK } from './muscles';
/**
 * Constructors for every Success Journey shape.
 *
 * Kept apart from the readers so there is exactly one definition of "empty"
 * in the feature. A fresh entry and a repaired-from-disk entry are built by
 * the same functions, which is what stops the two from drifting.
 */

import { makeId } from '../../lib/crypto';
import type {
  DailyEntry,
  DayKey,
  Habit,
  HabitGroup,
  Intake,
  Intention,
  JourneyState,
  MeasurementBaseline,
  MeasurementEntry,
  Movement,
  MovementCategory,
  PlusOne,
  Wod,
  WodLine,
} from './types';

/** The Plus One dimensions, in the order the workbook prints them. */
export const PLUS_ONE_KEYS = [
  'physical',
  'intellectual',
  'spiritual',
  'emotional',
  'social',
  'environmental',
] as const;

export const MOVEMENT_CATEGORIES: readonly MovementCategory[] = [
  'strength',
  'weightlifting',
  'gymnastics',
  'monostructural',
];

export const HABIT_GROUPS: readonly HabitGroup[] = [
  'health',
  'mind',
  'finance',
  'relationships',
  'environment',
];

export function emptyPlusOne(): PlusOne {
  return {
    physical: false,
    intellectual: false,
    spiritual: false,
    emotional: false,
    social: false,
    environmental: false,
  };
}

/** `done: null` — untouched, which is not the same as answered "no". */
export function emptyIntention(): Intention {
  return { text: '', done: null };
}

export function emptyWod(): Wod {
  return { tags: [], rounds: null, lines: [], structure: '', result: '' };
}

export function createWodLine(): WodLine {
  return { id: makeId(), reps: null, movementId: null, freeText: '', weightKg: null, notes: '' };
}

/**
 * A blank day.
 *
 * `wod` starts null rather than as an empty WOD: the difference is what lets
 * the home screen show a one-line "Log a workout" card instead of an empty
 * builder, which is the progressive-disclosure rule the feature is built on.
 */
export function createEntry(date: DayKey, now = Date.now()): DailyEntry {
  return {
    date,
    theme: '',
    story: '',
    wod: null,
    skill: '',
    decision: emptyIntention(),
    habit: emptyIntention(),
    plusOne: emptyPlusOne(),
    updatedAt: now,
  };
}

export function emptyBaseline(): MeasurementBaseline {
  return {
    heightCm: null,
    currentWeightKg: null,
    targetWeightKg: null,
    restingHeartRate: null,
    referenceHeartRate: null,
  };
}

export function createMeasurement(date: DayKey): MeasurementEntry {
  return {
    id: makeId(),
    date,
    weightKg: null,
    bodyFatPct: null,
    waterPct: null,
    musclePct: null,
    heartRateBefore: null,
    heartRateAfter: null,
    recoverySeconds: null,
    workoutsPerWeek: null,
  };
}

export function createMovement(
  name: string,
  category: MovementCategory,
  aliases: string[] = [],
): Movement {
  // Untagged on purpose: nobody has said what a movement somebody just
  // invented works, and an unshaded figure is honest where a guess is not.
  return { id: makeId(), name, category, aliases, isCustom: true, muscles: NO_MUSCLE_WORK };
}

export function createHabit(
  title: string,
  group: HabitGroup,
  templateId: string | null = null,
): Habit {
  return {
    id: makeId(),
    templateId,
    title,
    group,
    createdAt: Date.now(),
    archived: false,
  };
}

/**
 * A never-answered intake. Distinct from a skipped one: `skipped` records that
 * the user was asked and declined, so the app can stop asking without ever
 * having stored an answer.
 */
export function emptyIntake(): Intake {
  return {
    completedAt: null,
    skipped: false,
    currentlyTraining: null,
    daysPerWeek: null,
    sports: '',
    lastWorkoutDate: null,
    injuries: '',
    medicalConditions: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  };
}

/** A brand-new account's slice. No seeded rows — the JSON catalogues supply those. */
export function createJourneyState(schemaVersion: number): JourneyState {
  return {
    schemaVersion,
    entries: {},
    movements: [],
    benchmarks: [],
    results: [],
    baseline: emptyBaseline(),
    measurements: [],
    habits: [],
    checks: {},
    units: 'metric',
    bodyForm: 'male',
  };
}
