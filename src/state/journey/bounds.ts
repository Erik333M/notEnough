/**
 * Plausible ranges for every measurement field.
 *
 * One table, used by two places that must never disagree: the persistence
 * readers, which drop out-of-range values on load, and the input controls,
 * which clamp what can be typed. Keeping separate copies is how a value gets
 * accepted by a form and then silently discarded on the next launch.
 *
 * These are sanity bounds against typos and corrupt payloads, not judgements
 * about bodies — they are deliberately far wider than any real reading.
 */
export const BOUNDS = {
  /* baseline */
  heightCm: [50, 260],
  currentWeightKg: [20, 400],
  targetWeightKg: [20, 400],
  restingHeartRate: [20, 220],
  referenceHeartRate: [20, 260],

  /* dated readings */
  weightKg: [20, 400],
  bodyFatPct: [0, 100],
  waterPct: [0, 100],
  musclePct: [0, 100],
  heartRateBefore: [20, 260],
  heartRateAfter: [20, 260],
  /** Two hours is already absurd for catching your breath. */
  recoverySeconds: [0, 7200],
  workoutsPerWeek: [0, 40],
} as const satisfies Record<string, readonly [number, number]>;

export type BoundedField = keyof typeof BOUNDS;

export function lowerBound(field: BoundedField): number {
  return BOUNDS[field][0];
}

export function upperBound(field: BoundedField): number {
  return BOUNDS[field][1];
}

/** True when a value is inside its field's range. */
export function withinBounds(field: BoundedField, value: number): boolean {
  const [min, max] = BOUNDS[field];
  return value >= min && value <= max;
}
