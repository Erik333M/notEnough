/**
 * Baseline field descriptors and their unit conversions.
 *
 * Kept out of the sheet so the "which of these is a length, which is a weight,
 * which is just a number" question is answered once, in a place that can be
 * read without wading through JSX.
 */

import type { MeasurementBaseline, UnitSystem } from './types';
import {
  displayLength,
  displayWeight,
  lengthUnit,
  roundTo,
  storeLength,
  storeWeight,
  weightUnit,
} from './units';

export type BaselineKey = keyof MeasurementBaseline;

export type BaselineRow = {
  key: BaselineKey;
  label: string;
  /** Plain-language help. Absent where the label already says everything. */
  hint?: string;
};

export const BASELINE_ROWS: BaselineRow[] = [
  { key: 'heightCm', label: 'Height' },
  { key: 'currentWeightKg', label: 'Current weight' },
  {
    key: 'targetWeightKg',
    label: 'Target weight',
    hint: 'Only if you have one. The app never suggests a number.',
  },
  {
    key: 'restingHeartRate',
    label: 'Resting heart rate',
    hint: 'Beats per minute, measured sitting still.',
  },
  {
    key: 'referenceHeartRate',
    label: 'Reference heart rate',
    hint: 'The age-based figure your coach or scale gave you, if any.',
  },
];

const LENGTHS: BaselineKey[] = ['heightCm'];
const WEIGHTS: BaselineKey[] = ['currentWeightKg', 'targetWeightKg'];

export function baselineUnit(key: BaselineKey, units: UnitSystem): string {
  if (LENGTHS.includes(key)) return lengthUnit(units);
  if (WEIGHTS.includes(key)) return weightUnit(units);
  return 'bpm';
}

/** Stored (canonical) value -> the string the user should see. */
export function baselineToDisplay(
  key: BaselineKey,
  value: number | null,
  units: UnitSystem,
): string {
  if (value === null) return '';
  if (LENGTHS.includes(key)) return `${roundTo(displayLength(value, units) ?? value, 1)}`;
  if (WEIGHTS.includes(key)) return `${roundTo(displayWeight(value, units) ?? value, 1)}`;
  return `${value}`;
}

/** What was typed -> the canonical value, or null for "left blank". */
export function baselineToStored(
  key: BaselineKey,
  text: string,
  units: UnitSystem,
): number | null {
  if (!text.trim()) return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  if (LENGTHS.includes(key)) return storeLength(value, units);
  if (WEIGHTS.includes(key)) return storeWeight(value, units);
  return value;
}
