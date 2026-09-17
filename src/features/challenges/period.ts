/**
 * The window a challenge runs over, and what a full score looks like in it.
 *
 * Pure and import-free, because the date arithmetic is the part that actually
 * goes wrong — month ends, inclusive boundaries, a period that outlives the
 * app's history. Everything here is plain `YYYY-MM-DD` strings, which sort
 * chronologically as text and never become a `Date` that could drift a
 * timezone.
 */
export type ChallengeScope = 'daily' | 'weekly' | 'monthly';

/**
 * Three victories in a day is the whole premise of the daily challenge, so it
 * is also the unit every longer challenge is counted in. One rule, one number,
 * whatever the length.
 */
export const VICTORIES_PER_DAY = 3;

/** A year of days. A challenge longer than that is a mistake, not a plan. */
const MAX_DAYS = 400;

/** Every day from `from` to `to`, both ends included. */
export function daysInRange(from: string, to: string): string[] {
  if (!isDayKey(from) || !isDayKey(to) || to < from) return [];

  const out: string[] = [];
  const [year, month, day] = from.split('-').map(Number);
  const cursor = new Date(year, month - 1, day);

  while (out.length < MAX_DAYS) {
    const key = toKey(cursor);
    if (key > to) break;
    out.push(key);
    cursor.setDate(cursor.getDate() + 1);
  }

  return out;
}

export function dayCount(from: string, to: string): number {
  return daysInRange(from, to).length;
}

/** Every day of the window won outright — what the target defaults to. */
export function fullScore(from: string, to: string): number {
  return dayCount(from, to) * VICTORIES_PER_DAY;
}

/** Whether today falls inside the window, so a closed one can say so. */
export function isRunning(from: string, to: string, today: string): boolean {
  return today >= from && today <= to;
}

/**
 * How much of the window has gone.
 *
 * Used to say "you are behind" honestly: a third of the way through a month is
 * a different thing from a third of the way through the score.
 */
export function elapsedFraction(from: string, to: string, today: string): number {
  const total = dayCount(from, to);
  if (total === 0) return 0;
  if (today < from) return 0;
  if (today > to) return 1;
  return dayCount(from, today) / total;
}

/** The window a scope implies, starting today. Sunday-to-Saturday is avoided. */
export function suggestPeriod(scope: ChallengeScope, today: string): { from: string; to: string } {
  const [year, month, day] = today.split('-').map(Number);

  if (scope === 'daily') return { from: today, to: today };

  if (scope === 'weekly') {
    // Seven days from today rather than a calendar week: a challenge set on a
    // Thursday should run a week, not fizzle out on Sunday night.
    const end = new Date(year, month - 1, day + 6);
    return { from: today, to: toKey(end) };
  }

  // Calendar month, because "September" is what a monthly challenge is called.
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  return { from: toKey(first), to: toKey(last) };
}

function toKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isDayKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
