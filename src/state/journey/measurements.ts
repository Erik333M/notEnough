/**
 * Body measurements.
 *
 * Every field is optional, everywhere. A user who only ever logs weight has a
 * complete, valid history — so selectors here filter for the metric they were
 * asked about rather than assuming a row is fully populated.
 */

import { BOUNDS } from './bounds';
import type {
  JourneyState,
  MeasurementEntry,
  MeasurementMetricKey,
  UnitSystem,
} from './types';
import { displayWeight, roundTo, weightUnit } from './units';

export type MetricDescriptor = {
  key: MeasurementMetricKey;
  label: string;
  /** Fixed unit, or null when it depends on the user's preference. */
  unit: string | null;
  /** How many decimals the value is worth showing to. */
  decimals: number;
  /**
   * Which control to render. `duration` gets minutes and seconds boxes —
   * "time to get your breath back" is read off a clock, not counted in
   * seconds.
   */
  input: 'number' | 'duration';
  /** Plain-language help, shown under the field the first time it is added. */
  hint?: string;
};

/**
 * The chartable metrics, in the order the measurements screen lists them.
 * Weight leads because it is the one field most people actually log.
 */
export const MEASUREMENT_METRICS: MetricDescriptor[] = [
  { key: 'weightKg', label: 'Weight', unit: null, decimals: 1, input: 'number' },
  {
    key: 'bodyFatPct',
    label: 'Body fat',
    unit: '%',
    decimals: 1,
    input: 'number',
    hint: 'From a smart scale or a caliper reading, if you have one.',
  },
  { key: 'waterPct', label: 'Water', unit: '%', decimals: 1, input: 'number' },
  { key: 'musclePct', label: 'Muscle', unit: '%', decimals: 1, input: 'number' },
  {
    key: 'heartRateBefore',
    label: 'Heart rate before',
    unit: 'bpm',
    decimals: 0,
    input: 'number',
    hint: 'Beats per minute, taken before you start training.',
  },
  {
    key: 'heartRateAfter',
    label: 'Heart rate after',
    unit: 'bpm',
    decimals: 0,
    input: 'number',
    hint: 'Taken straight after you finish.',
  },
  {
    key: 'recoverySeconds',
    label: 'Breathing recovery',
    unit: null,
    decimals: 0,
    input: 'duration',
    hint: 'How long it took to get your breath back.',
  },
  {
    key: 'workoutsPerWeek',
    label: 'Workouts a week',
    unit: null,
    decimals: 0,
    input: 'number',
  },
];

/** Lookup by key, so a screen never scans the list. */
export const METRIC_BY_KEY: Record<MeasurementMetricKey, MetricDescriptor> =
  MEASUREMENT_METRICS.reduce(
    (acc, metric) => {
      acc[metric.key] = metric;
      return acc;
    },
    {} as Record<MeasurementMetricKey, MetricDescriptor>,
  );

/** The range a field accepts, shared with the persistence readers. */
export function metricBounds(key: MeasurementMetricKey): readonly [number, number] {
  return BOUNDS[key];
}

export function metricUnit(metric: MetricDescriptor, units: UnitSystem): string {
  if (metric.unit !== null) return metric.unit;
  return metric.key === 'weightKg' ? weightUnit(units) : '';
}

/** Measurements newest first. */
export function sortedMeasurements(state: JourneyState): MeasurementEntry[] {
  return [...state.measurements].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );
}

export type MetricPoint = { date: string; value: number };

/**
 * One metric's history, oldest first, skipping rows where it was left blank.
 * Weight is converted for display here so a chart axis never mixes units.
 *
 * Built by reversing `sortedMeasurements` rather than sorting ascending on its
 * own. Sorting by date alone leaves two readings taken on the same day in
 * storage order, which is newest-inserted-first — so weighing yourself morning
 * and evening would plot backwards, and "latest" would report the morning
 * figure. Same rule as `benchmarkSeries`, for the same reason.
 */
export function metricSeries(
  state: JourneyState,
  key: MeasurementMetricKey,
  units: UnitSystem,
): MetricPoint[] {
  const points: MetricPoint[] = [];

  for (const entry of sortedMeasurements(state).reverse()) {
    const raw = entry[key];
    if (raw === null) continue;
    const value = key === 'weightKg' ? (displayWeight(raw, units) ?? raw) : raw;
    points.push({ date: entry.date, value });
  }

  return points;
}

/** A chart needs two points to be a line — below that the screen shows the number. */
export function canChart(points: MetricPoint[]): boolean {
  return points.length >= 2;
}

export function latestMeasurement(state: JourneyState): MeasurementEntry | null {
  let latest: MeasurementEntry | null = null;
  for (const entry of state.measurements) {
    if (!latest || entry.date > latest.date) latest = entry;
  }
  return latest;
}

/** Most recent non-null value for one metric, in display units. */
export function latestValue(
  state: JourneyState,
  key: MeasurementMetricKey,
  units: UnitSystem,
): number | null {
  const points = metricSeries(state, key, units);
  return points.length > 0 ? points[points.length - 1].value : null;
}

/**
 * Change between the first and last reading of a metric.
 *
 * Returned unopinionated: this feature records, it does not judge, so nothing
 * here decides whether a direction is good. The screen shows the delta and
 * lets the user draw their own conclusion.
 */
export function metricChange(points: MetricPoint[]): number | null {
  if (points.length < 2) return null;
  return roundTo(points[points.length - 1].value - points[0].value, 1);
}

/** True when a row holds no readings at all — used to avoid saving a blank log. */
export function measurementIsEmpty(entry: MeasurementEntry): boolean {
  return MEASUREMENT_METRICS.every((metric) => entry[metric.key] === null);
}
