import { dayKey, recentDayKeys, weekdayLabel } from '../lib/time';
import type { AccentName } from '../theme/theme';
import type {
  AppState,
  IconName,
  VictoryDay,
  VictoryGoalKey,
  VictoryKey,
  VictoryLog,
  VictoryState,
  VictoryTargets,
} from './types';

/**
 * 3 Victories — nine fixed goals, three victories, one day.
 *
 * The catalogue below is the single source of truth for the feature: titles,
 * copy, icons and default targets all come from here, so a screen never
 * hard-codes a goal name. Only the *target* line is user-editable — the nine
 * categories are deliberately immutable, which is the whole premise of the
 * feature (you do not get to redefine the standard on a bad day).
 */

export type VictoryGoalDef = {
  key: VictoryGoalKey;
  victory: VictoryKey;
  title: string;
  description: string;
  /** Shown as one-tap suggestions in the target editor. */
  examples: string[];
  defaultTarget: string;
  icon: IconName;
};

export type VictoryDef = {
  key: VictoryKey;
  /** Spec'd emoji mark — the cross in particular has no Ionicons equivalent. */
  mark: string;
  label: string;
  title: string;
  purpose: string;
  accent: AccentName;
  icon: IconName;
  goals: VictoryGoalDef[];
};

/** BODY → MIND → SPIRIT. Iterate this, never a hand-written list. */
export const VICTORIES: VictoryDef[] = [
  {
    key: 'physical',
    mark: '🏋️',
    label: 'PHYSICAL',
    title: 'Physical Victory',
    purpose: 'Build and maintain a strong, healthy body.',
    accent: 'amber',
    icon: 'barbell',
    goals: [
      {
        key: 'hygiene',
        victory: 'physical',
        title: 'Hygiene & Care',
        description: 'Take care of your body through daily hygiene and personal care.',
        examples: ['Shower', 'Brush teeth', 'Grooming', 'Skincare', 'Clean clothes'],
        defaultTarget: 'Shower + brush teeth',
        icon: 'water',
      },
      {
        key: 'strength',
        victory: 'physical',
        title: 'Strength & Mobility',
        description: 'Train your body and maintain strength, flexibility and mobility.',
        examples: [
          'Workout',
          '30 push-ups',
          'Squats',
          'Pull-ups',
          '20 min workout',
          'Walking',
          'Stretching',
          'Mobility',
        ],
        defaultTarget: '20 min workout',
        icon: 'body',
      },
      {
        key: 'recovery',
        victory: 'physical',
        title: 'Fuel & Recovery',
        description: 'Give your body proper nutrition, hydration and recovery.',
        examples: [
          'Drink 3 L water',
          'Eat healthy food',
          'Enough protein',
          'No junk food',
          'Sleep 8 hours',
          'Recovery',
        ],
        defaultTarget: '3 L water + 8 h sleep',
        icon: 'moon',
      },
    ],
  },
  {
    key: 'mind',
    mark: '🧠',
    label: 'MIND',
    title: 'Mind Victory',
    purpose: 'Become smarter, more disciplined and better at your profession.',
    accent: 'cyan',
    icon: 'bulb',
    goals: [
      {
        key: 'deepWork',
        victory: 'mind',
        title: 'Deep Work',
        description: 'Do focused, meaningful professional work without distractions.',
        examples: ['30 min deep work', '60 min deep work', 'Complete one important task'],
        defaultTarget: '60 min deep work',
        icon: 'timer',
      },
      {
        key: 'learn',
        victory: 'mind',
        title: 'Learn',
        description: 'Improve knowledge and professional skills.',
        examples: [
          'Read 10 pages',
          'Study 30 minutes',
          'Complete a lesson',
          'Practice a skill',
          'Read technical material',
        ],
        defaultTarget: 'Read 10 pages',
        icon: 'school',
      },
      {
        key: 'reflection',
        victory: 'mind',
        title: 'Think & Reflect',
        description: 'Improve clear thinking through reflection and planning.',
        examples: [
          'Journal 5 minutes',
          'Plan tomorrow',
          "Review today's mistakes",
          'Write what you learned',
          'Solve one hard problem',
          '10 min without the phone',
        ],
        defaultTarget: 'Journal 5 min + plan tomorrow',
        icon: 'create',
      },
    ],
  },
  {
    key: 'spiritual',
    mark: '✝️',
    label: 'SPIRIT',
    title: 'Spiritual Victory',
    purpose: 'Grow closer to God and live the Christian faith.',
    accent: 'violet',
    icon: 'sparkles',
    goals: [
      {
        key: 'prayer',
        victory: 'spiritual',
        title: 'Prayer',
        description: 'Spend intentional time in prayer.',
        examples: [
          'Morning prayer',
          'Evening prayer',
          '10 minutes prayer',
          'Gratitude',
          'Pray for someone',
        ],
        defaultTarget: '10 minutes prayer',
        icon: 'heart',
      },
      {
        key: 'scripture',
        victory: 'spiritual',
        title: 'Scripture',
        description: 'Read and reflect on the Bible.',
        examples: [
          'Read 1 chapter',
          'Read 10 verses',
          'Follow reading plan',
          'Memorize a verse',
          'Write what you learned',
        ],
        defaultTarget: 'Read 1 chapter',
        icon: 'book',
      },
      {
        key: 'faith',
        victory: 'spiritual',
        title: 'Live Your Faith',
        description: 'Put Christian faith into action.',
        examples: [
          'Help someone',
          'Encourage someone',
          'Forgive someone',
          'Practice humility',
          'Resist temptation',
          'Act of kindness',
          'Attend church',
          'Reflect on today',
        ],
        defaultTarget: 'One act of kindness',
        icon: 'hand-left',
      },
    ],
  },
];

/** Flat view of the catalogue, in dashboard order. */
export const VICTORY_GOALS: VictoryGoalDef[] = VICTORIES.flatMap((v) => v.goals);

export const TOTAL_VICTORY_GOALS = VICTORY_GOALS.length; // 9

export function victoryDef(key: VictoryKey): VictoryDef {
  const found = VICTORIES.find((v) => v.key === key);
  // Unreachable: VictoryKey is a closed union over the catalogue.
  if (!found) throw new Error(`Unknown victory: ${key}`);
  return found;
}

export function goalDef(key: VictoryGoalKey): VictoryGoalDef {
  const found = VICTORY_GOALS.find((g) => g.key === key);
  if (!found) throw new Error(`Unknown victory goal: ${key}`);
  return found;
}

/* -------------------------------------------------------------- day records */

/** A fresh day: every new day starts at 0 / 9. */
export function emptyVictoryDay(): VictoryDay {
  return {
    physical: { hygiene: false, strength: false, recovery: false },
    mind: { deepWork: false, learn: false, reflection: false },
    spiritual: { prayer: false, scripture: false, faith: false },
  };
}

export function defaultVictoryTargets(): VictoryTargets {
  return {
    hygiene: goalDef('hygiene').defaultTarget,
    strength: goalDef('strength').defaultTarget,
    recovery: goalDef('recovery').defaultTarget,
    deepWork: goalDef('deepWork').defaultTarget,
    learn: goalDef('learn').defaultTarget,
    reflection: goalDef('reflection').defaultTarget,
    prayer: goalDef('prayer').defaultTarget,
    scripture: goalDef('scripture').defaultTarget,
    faith: goalDef('faith').defaultTarget,
  };
}

export function createVictoryState(): VictoryState {
  return { targets: defaultVictoryTargets(), log: {} };
}

/**
 * A missing day is an unstarted day, not an error — reading one never mutates
 * the log, so simply opening the app on a new date writes nothing.
 */
export function victoryDay(log: VictoryLog, day: string): VictoryDay {
  return log[day] ?? emptyVictoryDay();
}

/**
 * The nine slots are split across three typed groups, so reading and writing
 * one goes through an explicit switch. Verbose by design: it keeps the stored
 * shape self-describing without an index signature that would let a typo
 * through.
 */
export function isGoalDone(day: VictoryDay, goal: VictoryGoalKey): boolean {
  switch (goal) {
    case 'hygiene':
    case 'strength':
    case 'recovery':
      return day.physical[goal];
    case 'deepWork':
    case 'learn':
    case 'reflection':
      return day.mind[goal];
    case 'prayer':
    case 'scripture':
    case 'faith':
      return day.spiritual[goal];
  }
}

export function withGoalDone(day: VictoryDay, goal: VictoryGoalKey, done: boolean): VictoryDay {
  switch (goal) {
    case 'hygiene':
    case 'strength':
    case 'recovery':
      return { ...day, physical: { ...day.physical, [goal]: done } };
    case 'deepWork':
    case 'learn':
    case 'reflection':
      return { ...day, mind: { ...day.mind, [goal]: done } };
    case 'prayer':
    case 'scripture':
    case 'faith':
      return { ...day, spiritual: { ...day.spiritual, [goal]: done } };
  }
}

/* ---------------------------------------------------------------- selectors */

/** How many of a victory's three goals are closed. */
export function victoryScore(day: VictoryDay, victory: VictoryKey): number {
  const group = day[victory];
  let count = 0;
  for (const value of Object.values(group)) if (value) count += 1;
  return count;
}

export function isVictoryWon(day: VictoryDay, victory: VictoryKey): boolean {
  return victoryScore(day, victory) === victoryDef(victory).goals.length;
}

/** Goals closed across all three victories, 0..9. */
export function dayScore(day: VictoryDay): number {
  let total = 0;
  for (const victory of VICTORIES) total += victoryScore(day, victory.key);
  return total;
}

/** Victories won that day, 0..3. */
export function victoriesWon(day: VictoryDay): number {
  let won = 0;
  for (const victory of VICTORIES) if (isVictoryWon(day, victory.key)) won += 1;
  return won;
}

export function isDayWon(day: VictoryDay): boolean {
  return dayScore(day) === TOTAL_VICTORY_GOALS;
}

export type VictoryDayRecord = {
  date: string;
} & VictoryDay;

/** A stored day in the documented wire shape, for history and export. */
export function victoryDayRecord(state: AppState, day: string): VictoryDayRecord {
  return { date: day, ...victoryDay(state.victories.log, day) };
}

/**
 * Consecutive days ending today where all nine goals were won. An unfinished
 * today does not break the run — same rule the goal streak already uses, so
 * the two numbers never contradict each other.
 */
export function victoryStreak(log: VictoryLog, from: Date = new Date()): number {
  let streak = 0;
  for (let i = 0; i < 365; i += 1) {
    const cursor = new Date(from);
    cursor.setDate(cursor.getDate() - i);
    const day = log[dayKey(cursor)];

    if (day && isDayWon(day)) {
      streak += 1;
      continue;
    }
    if (i === 0) continue;
    break;
  }
  return streak;
}

/** Days on record where all nine were won. */
export function totalDaysWon(log: VictoryLog): number {
  let count = 0;
  for (const day of Object.values(log)) if (isDayWon(day)) count += 1;
  return count;
}

export type VictoryPoint = { key: string; label: string; value: number; highlight: boolean };

/** Goals closed per day for the last `days` days, as a percentage of nine. */
export function victorySeries(log: VictoryLog, days = 7): VictoryPoint[] {
  const today = dayKey();
  return recentDayKeys(days).map((key) => ({
    key,
    label: weekdayLabel(key),
    value: Math.round((dayScore(victoryDay(log, key)) / TOTAL_VICTORY_GOALS) * 100),
    highlight: key === today,
  }));
}
