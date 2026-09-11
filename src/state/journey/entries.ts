/**
 * Daily entry selectors.
 *
 * Every read here is non-mutating: asking for a day that was never written
 * returns a blank entry rather than creating one. That is what lets the user
 * page back through months of history without leaving a trail of empty days
 * in storage — and what keeps "days logged" an honest number.
 */

import { dayKey, recentDayKeys } from '../../lib/time';
import { PLUS_ONE_KEYS, createEntry } from './factory';
import type { DailyEntry, DayKey, JourneyState, PlusOne, Wod } from './types';

/** A stored day, or a blank one. Never writes. */
export function entryFor(state: JourneyState, date: DayKey): DailyEntry {
  return state.entries[date] ?? createEntry(date, 0);
}

export function hasEntry(state: JourneyState, date: DayKey): boolean {
  return state.entries[date] !== undefined;
}

export function plusOneCount(plusOne: PlusOne): number {
  let count = 0;
  for (const key of PLUS_ONE_KEYS) if (plusOne[key]) count += 1;
  return count;
}

export function wodIsEmpty(wod: Wod | null): boolean {
  if (!wod) return true;
  return (
    wod.tags.length === 0 &&
    wod.rounds === null &&
    wod.lines.length === 0 &&
    !wod.structure.trim() &&
    !wod.result.trim()
  );
}

/**
 * Whether a day holds anything worth keeping.
 *
 * Used to decide if a day counts as "logged" and whether an autosaved draft
 * should survive. Deliberately generous: one ticked Plus One box is a logged
 * day. The bar for having shown up is low on purpose.
 */
export function entryHasContent(entry: DailyEntry): boolean {
  return (
    entry.theme.trim().length > 0 ||
    entry.story.trim().length > 0 ||
    entry.skill.trim().length > 0 ||
    entry.decision.text.trim().length > 0 ||
    entry.decision.done !== null ||
    entry.habit.text.trim().length > 0 ||
    entry.habit.done !== null ||
    plusOneCount(entry.plusOne) > 0 ||
    !wodIsEmpty(entry.wod)
  );
}

/** One dot on the calendar strip. */
export type DayDot = {
  key: DayKey;
  filled: boolean;
  isToday: boolean;
  /** 0..1 — how much of the day was filled in, for a softer dot than on/off. */
  intensity: number;
};

/**
 * Density of a single day, 0..1, across the five things a day can hold.
 * Used only for dot intensity — never shown as a score, and never used to
 * tell the user a day was insufficient.
 */
function entryDensity(entry: DailyEntry): number {
  const signals = [
    entry.theme.trim().length > 0,
    entry.decision.text.trim().length > 0 || entry.decision.done !== null,
    entry.habit.text.trim().length > 0 || entry.habit.done !== null,
    plusOneCount(entry.plusOne) > 0,
    !wodIsEmpty(entry.wod),
  ];
  const hit = signals.filter(Boolean).length;
  return hit / signals.length;
}

/**
 * The last `count` days, oldest first — the home screen's calendar strip.
 *
 * Reads a fixed window rather than walking the whole log, so the strip costs
 * the same on day 1 and in year 3.
 */
export function dayStrip(state: JourneyState, count = 14, from = new Date()): DayDot[] {
  const today = dayKey(from);
  return recentDayKeys(count, from).map((key) => {
    const entry = state.entries[key];
    const filled = entry ? entryHasContent(entry) : false;
    return {
      key,
      filled,
      isToday: key === today,
      intensity: entry && filled ? entryDensity(entry) : 0,
    };
  });
}

/**
 * Day keys that hold real content, newest first.
 *
 * Sorting `YYYY-MM-DD` as text is chronological, so history paging never
 * constructs a single `Date`. Callers slice this for a page rather than
 * rendering it whole.
 */
export function loggedDayKeys(state: JourneyState): DayKey[] {
  const keys: DayKey[] = [];
  for (const [key, entry] of Object.entries(state.entries)) {
    if (entryHasContent(entry)) keys.push(key);
  }
  return keys.sort().reverse();
}

export function totalDaysLogged(state: JourneyState): number {
  let count = 0;
  for (const entry of Object.values(state.entries)) if (entryHasContent(entry)) count += 1;
  return count;
}

/** Days logged within the calendar month containing `from`. */
export function daysLoggedThisMonth(state: JourneyState, from = new Date()): number {
  const prefix = dayKey(from).slice(0, 7);
  let count = 0;
  for (const [key, entry] of Object.entries(state.entries)) {
    if (key.startsWith(prefix) && entryHasContent(entry)) count += 1;
  }
  return count;
}

/**
 * Consecutive logged days ending today.
 *
 * An unfinished today does not break the run — the same rule the goal and
 * victory streaks already use, so the three numbers can never contradict each
 * other on the same screen.
 */
export function entryStreak(state: JourneyState, from = new Date()): number {
  let streak = 0;
  for (let i = 0; i < 365; i += 1) {
    const cursor = new Date(from);
    cursor.setDate(cursor.getDate() - i);
    const entry = state.entries[dayKey(cursor)];

    if (entry && entryHasContent(entry)) {
      streak += 1;
      continue;
    }
    if (i === 0) continue;
    break;
  }
  return streak;
}
