import { dayKey, recentDayKeys, weekdayLabel } from '../lib/time';
import type { AppState, Goal, ProgressLog } from './types';

export function goalAmount(log: ProgressLog, day: string, goalId: string): number {
  return log[day]?.[goalId] ?? 0;
}

export function goalRatio(goal: Goal, amount: number): number {
  if (goal.target <= 0) return 0;
  return Math.min(1, amount / goal.target);
}

export function activeGoals(state: AppState): Goal[] {
  return state.goals.filter((g) => !g.archived);
}

/** Average completion across active goals for a day, 0..1. */
export function dayCompletion(state: AppState, day: string, goals = activeGoals(state)): number {
  if (goals.length === 0) return 0;
  let total = 0;
  for (const goal of goals) total += goalRatio(goal, goalAmount(state.log, day, goal.id));
  return total / goals.length;
}

export function goalsClosed(state: AppState, day: string, goals = activeGoals(state)): number {
  let closed = 0;
  for (const goal of goals) {
    if (goalAmount(state.log, day, goal.id) >= goal.target) closed += 1;
  }
  return closed;
}

/** A day counts toward the streak at >= 60% average completion. */
const STREAK_THRESHOLD = 0.6;

export function currentStreak(state: AppState): number {
  const goals = activeGoals(state);
  if (goals.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i += 1) {
    const cursor = new Date(today);
    cursor.setDate(cursor.getDate() - i);
    const key = dayKey(cursor);
    const completion = dayCompletion(state, key, goals);

    if (completion >= STREAK_THRESHOLD) {
      streak += 1;
      continue;
    }
    // Today only breaks the streak once it is over — an unfinished today is fine.
    if (i === 0) continue;
    break;
  }
  return streak;
}

export function bestStreak(state: AppState): number {
  const goals = activeGoals(state);
  if (goals.length === 0) return 0;
  const days = Object.keys(state.log).sort();
  let best = 0;
  let run = 0;
  let previous: number | null = null;

  for (const key of days) {
    const [y, m, d] = key.split('-').map(Number);
    const stamp = new Date(y, m - 1, d).getTime();
    const contiguous = previous !== null && Math.round((stamp - previous) / 86400000) === 1;
    run = dayCompletion(state, key, goals) >= STREAK_THRESHOLD ? (contiguous ? run + 1 : 1) : 0;
    best = Math.max(best, run);
    previous = stamp;
  }
  return best;
}

export type SeriesPoint = { key: string; label: string; value: number; highlight: boolean };

/** Completion percentage per day for the last `days` days. */
export function completionSeries(state: AppState, days = 7): SeriesPoint[] {
  const goals = activeGoals(state);
  const today = dayKey();
  return recentDayKeys(days).map((key) => ({
    key,
    label: weekdayLabel(key),
    value: Math.round(dayCompletion(state, key, goals) * 100),
    highlight: key === today,
  }));
}

export function totalRunDistance(state: AppState): number {
  let total = 0;
  for (const run of state.runs) total += run.distanceM;
  return total;
}

export function totalRunTime(state: AppState): number {
  let total = 0;
  for (const run of state.runs) total += run.durationMs;
  return total;
}

/** Days with at least one logged entry — used for "active days" stats. */
export function activeDayCount(state: AppState): number {
  let count = 0;
  for (const day of Object.keys(state.log)) {
    const entries = state.log[day];
    if (entries && Object.values(entries).some((v) => v > 0)) count += 1;
  }
  return count;
}

const levelBaseWeeks = { Starter: 24, Developing: 16, Advanced: 10 } as const;
const goalMultiplier = {
  'Reliable match control': 1,
  'Press-resistant control': 1.35,
  'Elite first touch': 1.75,
} as const;
export const stretchGoalMap = {
  'Reliable match control': 'Press-resistant control',
  'Press-resistant control': 'Elite first touch',
  'Elite first touch': 'Game-breaking ball mastery',
} as const;

export type Projection = {
  weeks: number;
  totalHours: number;
  stretchGoal: string;
  readiness: string;
  completionRate: number;
};

export function projectPlan(plan: AppState['plan']): Projection {
  const { currentState, goal, hoursPerDay, daysPerWeek } = plan;
  const rawWeeks =
    (levelBaseWeeks[currentState] * goalMultiplier[goal]) /
    Math.max(hoursPerDay, 1) /
    (daysPerWeek / 5);
  const weeks = Math.max(6, Math.round(rawWeeks));

  return {
    weeks,
    totalHours: weeks * hoursPerDay * daysPerWeek,
    stretchGoal: stretchGoalMap[goal],
    readiness:
      hoursPerDay >= 2 ? 'Aggressive' : daysPerWeek >= 6 ? 'High consistency' : 'Steady progress',
    completionRate: Math.min(86, Math.round((daysPerWeek * hoursPerDay * 8) / weeks)),
  };
}
