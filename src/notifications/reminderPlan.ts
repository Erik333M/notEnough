import type { Assignment } from '../api/teams';

/**
 * Which session reminders should exist, given the work you have been set.
 *
 * Pure on purpose — no expo-notifications, no platform, no clock beyond the
 * `today` passed in. The scheduling side of this is untestable off-device, so
 * the decisions worth getting right live here where they can be checked.
 */
export type ReminderPlan = { sessionId: string; date: string; count: number };

/** Early enough to plan the day around, late enough not to wake anyone. */
export const REMINDER_HOUR = 8;
export const REMINDER_MINUTE = 0;

/**
 * One reminder per session date, not one per task.
 *
 * Four tasks in a session is one thing to do, and four buzzes for it is how a
 * person ends up turning notifications off altogether.
 */
export function planReminders(assignments: Assignment[], today: string): ReminderPlan[] {
  const byDate = new Map<string, ReminderPlan>();

  for (const row of assignments) {
    // Nothing already finished, and nothing in the past: a reminder for
    // yesterday is noise, and overdue work is on Today regardless.
    if (row.result?.done) continue;
    if (row.dueDate < today) continue;

    // Standalone tasks share one key per day deliberately: two loose tasks on
    // the same day are still one thing to be told about.
    const key = `${row.sessionId ?? 'standalone'}:${row.dueDate}`;
    const existing = byDate.get(key);
    if (existing) existing.count += 1;
    else byDate.set(key, { sessionId: row.sessionId ?? row.id, date: row.dueDate, count: 1 });
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function reminderBody(plan: ReminderPlan): string {
  return plan.count === 1
    ? 'One task from your coach today.'
    : `${plan.count} tasks from your coach today.`;
}

/** `YYYY-MM-DD` at the reminder hour in the device's own zone, or null if past. */
export function reminderDate(dayKey: string, now: number = Date.now()): Date | null {
  const [year, month, day] = dayKey.split('-').map(Number);
  if (!year || !month || !day) return null;
  const when = new Date(year, month - 1, day, REMINDER_HOUR, REMINDER_MINUTE, 0, 0);
  return when.getTime() <= now ? null : when;
}
