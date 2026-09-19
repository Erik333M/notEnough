import { addDays, dayKey } from '../../lib/time';

/**
 * How an event reads.
 *
 * Kept out of the screens so the same camp is described the same way on a list
 * row, on its own page and in a toast.
 */

/** A camp that starts and ends on the same day lasts one day, not zero. */
export function dayCount(startDate: string, endDate: string): number {
  const ms = Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`);
  return Math.round(ms / 86400000) + 1;
}

export function endDateFor(startDate: string, days: number): string {
  return dayKey(addDays(new Date(`${startDate}T00:00:00`), days - 1));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "14 Jul" — the year only when it is not this one. */
export function formatDay(key: string, today = dayKey()): string {
  const [year, month, day] = key.split('-');
  const label = `${Number(day)} ${MONTHS[Number(month) - 1] ?? ''}`;
  return year === today.slice(0, 4) ? label : `${label} ${year}`;
}

export function formatRange(startDate: string, endDate: string): string {
  if (startDate === endDate) return formatDay(startDate);
  return `${formatDay(startDate)} – ${formatDay(endDate)}`;
}

export const durationLabel = (days: number) => `${days} day${days === 1 ? '' : 's'}`;

/** "Ages 10–14", or nothing at all when it is open to everyone. */
export function ageLabel(ageMin: number, ageMax: number): string | null {
  if (ageMin <= 0 && ageMax >= 99) return null;
  if (ageMin <= 0) return `Up to ${ageMax}`;
  if (ageMax >= 99) return `${ageMin} and up`;
  if (ageMin === ageMax) return `Age ${ageMin}`;
  return `Ages ${ageMin}–${ageMax}`;
}

export type EventPhase = 'upcoming' | 'running' | 'finished';

export function phaseOf(startDate: string, endDate: string, today = dayKey()): EventPhase {
  if (today < startDate) return 'upcoming';
  if (today > endDate) return 'finished';
  return 'running';
}

/** "Starts in 3 days", "Day 2 of 10", "Finished". */
export function phaseLabel(startDate: string, endDate: string, today = dayKey()): string {
  const phase = phaseOf(startDate, endDate, today);
  if (phase === 'finished') return 'Finished';
  if (phase === 'running') {
    return `Day ${dayCount(startDate, today)} of ${dayCount(startDate, endDate)}`;
  }
  const away = dayCount(today, startDate) - 1;
  if (away === 0) return 'Starts today';
  if (away === 1) return 'Starts tomorrow';
  return `Starts in ${away} days`;
}
