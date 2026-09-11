/**
 * Unit conversion at the display edge.
 *
 * Storage is always canonical — kilograms, centimetres, seconds — and the unit
 * preference is a presentation choice applied on the way in and out. Storing
 * whatever the user last typed would mean a history that silently mixes pounds
 * and kilos, and no later fix could tell which row was which.
 */

import type { UnitSystem } from './types';

const LB_PER_KG = 2.2046226218;
const CM_PER_IN = 2.54;

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

export function cmToIn(cm: number): number {
  return cm / CM_PER_IN;
}

export function inToCm(inches: number): number {
  return inches * CM_PER_IN;
}

export function weightUnit(units: UnitSystem): string {
  return units === 'metric' ? 'kg' : 'lb';
}

export function lengthUnit(units: UnitSystem): string {
  return units === 'metric' ? 'cm' : 'in';
}

/** Canonical kilograms -> the number to show. */
export function displayWeight(kg: number | null, units: UnitSystem): number | null {
  if (kg === null) return null;
  return units === 'metric' ? kg : kgToLb(kg);
}

/** What the user typed -> canonical kilograms. */
export function storeWeight(value: number | null, units: UnitSystem): number | null {
  if (value === null) return null;
  return units === 'metric' ? value : lbToKg(value);
}

export function displayLength(cm: number | null, units: UnitSystem): number | null {
  if (cm === null) return null;
  return units === 'metric' ? cm : cmToIn(cm);
}

export function storeLength(value: number | null, units: UnitSystem): number | null {
  if (value === null) return null;
  return units === 'metric' ? value : inToCm(value);
}

/** Trims float noise from a converted value without lying about precision. */
export function roundTo(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Seconds -> "M:SS" or "H:MM:SS". Benchmark times and recovery both use it. */
export function formatSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = `${minutes}`.padStart(hours > 0 ? 2 : 1, '0');
  const ss = `${seconds}`.padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
