import type { AccentName } from '../../theme/theme';
import type { IconName } from '../../state/types';

/**
 * Achievements, worked out from data the app already has.
 *
 * Nothing new is recorded to make these exist — they are a reading of your
 * streak, your benchmark history and the work you finished. That matters for
 * more than tidiness: an achievement that is derived cannot leak anything the
 * underlying data would not, and there is no achievements table to protect.
 *
 * Pure on purpose, so the rules can be tested without a device or a database.
 */
export type AchievementKind = 'streak' | 'personalBest' | 'habit' | 'work';

export type Achievement = {
  /** Stable across recomputes: it is how "already shared" is recognised. */
  id: string;
  kind: AchievementKind;
  title: string;
  detail: string;
  value: number;
  achievedAt: string;
  icon: IconName;
  accent: AccentName;
};

/**
 * Only the highest milestone passed, never the whole ladder.
 *
 * Someone on a 30 day streak has also passed 3, 7 and 14, and listing all four
 * turns a wall of achievement into wallpaper. One card, the best one.
 */
const STREAK_STEPS = [3, 7, 14, 30, 60, 100, 200, 365];
const WORK_STEPS = [1, 5, 10, 25, 50, 100, 250];

function highestPassed(value: number, steps: number[]): number | null {
  let best: number | null = null;
  for (const step of steps) if (value >= step) best = step;
  return best;
}

export type PersonalBest = {
  /** The benchmark's id, so the achievement id is stable per test. */
  definitionId: string;
  name: string;
  /** Already formatted in the user's own units — "140 kg", "3:42". */
  display: string;
  value: number;
  date: string;
};

export type AchievementInput = {
  streak: number;
  today: string;
  personalBests: PersonalBest[];
  /** Tasks a coach set that you finished, across every team. */
  workDone: number;
  /** The longest run of consecutive days on any single habit. */
  habitRun?: { title: string; days: number; date: string } | null;
};

const HABIT_STEPS = [7, 14, 30, 60, 100];

export function deriveAchievements(input: AchievementInput): Achievement[] {
  const out: Achievement[] = [];

  const streak = highestPassed(input.streak, STREAK_STEPS);
  if (streak) {
    out.push({
      id: `streak:${streak}`,
      kind: 'streak',
      title: `${streak} day streak`,
      detail:
        streak >= 100
          ? 'Three months and counting. This is just what you do now.'
          : 'Turning up, day after day. That is the whole trick.',
      value: streak,
      achievedAt: input.today,
      icon: 'flame',
      accent: 'amber',
    });
  }

  for (const best of input.personalBests) {
    out.push({
      // Dated, so beating it again is a new achievement rather than a silent
      // overwrite of the old one.
      id: `pb:${best.definitionId}:${best.date}`,
      kind: 'personalBest',
      title: `New best: ${best.name}`,
      detail: best.display,
      value: best.value,
      achievedAt: best.date,
      icon: 'trophy',
      accent: 'violet',
    });
  }

  const habit = input.habitRun;
  const habitStep = habit ? highestPassed(habit.days, HABIT_STEPS) : null;
  if (habit && habitStep) {
    out.push({
      id: `habit:${habit.title}:${habitStep}`,
      kind: 'habit',
      title: `${habitStep} days: ${habit.title}`,
      detail: 'Kept up without a gap.',
      value: habitStep,
      achievedAt: habit.date,
      icon: 'repeat',
      accent: 'lime',
    });
  }

  const work = highestPassed(input.workDone, WORK_STEPS);
  if (work) {
    out.push({
      id: `work:${work}`,
      kind: 'work',
      title: work === 1 ? 'First session done' : `${work} sessions done`,
      detail: 'Work your coach set, finished.',
      value: work,
      achievedAt: input.today,
      icon: 'checkmark-done',
      accent: 'cyan',
    });
  }

  // Most recent first — a new best should not be buried under an old streak.
  return out.sort((a, b) => b.achievedAt.localeCompare(a.achievedAt));
}
