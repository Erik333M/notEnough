/**
 * Habits — adopted from templates or written by the user, ticked once a day.
 *
 * Note this is *not* the same thing as the `habit` line on a daily entry. The
 * workbook prints one "I will…" habit per page, which is that day's intention;
 * these are standing habits with a streak. They are linked only by the user
 * choosing to copy one into today's line.
 */

import { dayKey, recentDayKeys } from '../../lib/time';
import seed from './data/habits.json';
import { HABIT_GROUPS } from './factory';
import type { Habit, HabitChecks, HabitGroup, HabitTemplate, JourneyState } from './types';

/**
 * Templates are presentation data, not state: adopting one copies its title
 * into a `Habit`, so editing the seed file never rewrites a habit someone is
 * already running.
 */
export const HABIT_TEMPLATES: HabitTemplate[] = (seed.templates as unknown[])
  .map((row) => {
    if (typeof row !== 'object' || row === null) return null;
    const record = row as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id : '';
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    if (!id || !title) return null;

    const group = HABIT_GROUPS.includes(record.group as HabitGroup)
      ? (record.group as HabitGroup)
      : 'health';
    return { id, title, group };
  })
  .filter((t): t is HabitTemplate => t !== null);

export const HABIT_GROUP_LABEL: Record<HabitGroup, string> = {
  health: 'Health',
  mind: 'Mind',
  finance: 'Money',
  relationships: 'People',
  environment: 'Space',
};

export function activeHabits(state: JourneyState): Habit[] {
  return state.habits.filter((h) => !h.archived);
}

export function habitById(state: JourneyState, id: string): Habit | null {
  return state.habits.find((h) => h.id === id) ?? null;
}

/** Templates the user has not adopted yet — the browser hides the rest. */
export function availableTemplates(state: JourneyState): HabitTemplate[] {
  const adopted = new Set(
    state.habits.filter((h) => !h.archived && h.templateId).map((h) => h.templateId),
  );
  return HABIT_TEMPLATES.filter((t) => !adopted.has(t.id));
}

export function templatesByGroup(
  templates: HabitTemplate[],
): Array<{ group: HabitGroup; label: string; items: HabitTemplate[] }> {
  return (Object.keys(HABIT_GROUP_LABEL) as HabitGroup[])
    .map((group) => ({
      group,
      label: HABIT_GROUP_LABEL[group],
      items: templates.filter((t) => t.group === group),
    }))
    .filter((entry) => entry.items.length > 0);
}

export function isChecked(checks: HabitChecks, day: string, habitId: string): boolean {
  return checks[day]?.[habitId] === true;
}

/** How many of today's habits are ticked. */
export function checkedCount(checks: HabitChecks, day: string, habits: Habit[]): number {
  const today = checks[day];
  if (!today) return 0;
  let count = 0;
  for (const habit of habits) if (today[habit.id] === true) count += 1;
  return count;
}

/**
 * Consecutive ticked days ending today.
 *
 * An untouched today does not break the streak — it has not been missed yet,
 * it just has not happened. Same rule as every other streak in the app.
 */
export function habitStreak(checks: HabitChecks, habitId: string, from = new Date()): number {
  let streak = 0;
  for (let i = 0; i < 365; i += 1) {
    const cursor = new Date(from);
    cursor.setDate(cursor.getDate() - i);

    if (isChecked(checks, dayKey(cursor), habitId)) {
      streak += 1;
      continue;
    }
    if (i === 0) continue;
    break;
  }
  return streak;
}

export type HabitDay = {
  key: string;
  done: boolean;
  /**
   * False for days before the habit existed.
   *
   * Without this a habit adopted today renders a fortnight of empty dots that
   * read as a fortnight of misses — the exact guilt this feature is meant to
   * avoid, and a direct contradiction of `habitConsistency`, which has always
   * counted only from the day the habit was added.
   */
  tracked: boolean;
};

/** Ticks over a recent window, oldest first — a per-habit dot row. */
export function habitHistory(
  checks: HabitChecks,
  habit: Habit,
  days = 14,
  from = new Date(),
): HabitDay[] {
  const since = dayKey(new Date(habit.createdAt));
  return recentDayKeys(days, from).map((key) => ({
    key,
    done: isChecked(checks, key, habit.id),
    tracked: key >= since,
  }));
}

/**
 * Share of possible ticks over a window, 0..1, across every active habit.
 *
 * Only counts days on or after a habit was created, so adopting a habit today
 * does not open with a month of apparent misses.
 */
export function habitConsistency(
  state: JourneyState,
  days = 30,
  from = new Date(),
): number {
  const habits = activeHabits(state);
  if (habits.length === 0) return 0;

  const window = recentDayKeys(days, from);
  let possible = 0;
  let done = 0;

  for (const habit of habits) {
    const since = dayKey(new Date(habit.createdAt));
    for (const key of window) {
      if (key < since) continue;
      possible += 1;
      if (isChecked(state.checks, key, habit.id)) done += 1;
    }
  }

  return possible === 0 ? 0 : done / possible;
}
