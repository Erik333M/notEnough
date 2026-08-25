import { createVictoryState, defaultVictoryTargets, emptyVictoryDay } from './victories';
import type { AppState, Goal, VictoryDay, VictoryLog, VictoryState } from './types';

export const STATE_VERSION = 2;

/** Seed goals so a brand-new account has something meaningful on day one. */
export function starterGoals(now: string): Goal[] {
  return [
    {
      id: 'seed-run',
      title: 'Easy run',
      detail: 'Zone 2 pace — conversational the whole way.',
      kind: 'distance',
      target: 5000,
      accent: 'cyan',
      icon: 'walk',
      reminder: { enabled: true, hour: 7, minute: 0, notificationId: null },
      createdAt: now,
      archived: false,
    },
    {
      id: 'seed-touches',
      title: 'Ball touches',
      detail: 'Toe taps, sole rolls, inside-outside.',
      kind: 'minutes',
      target: 20,
      accent: 'violet',
      icon: 'football',
      reminder: { enabled: true, hour: 18, minute: 30, notificationId: null },
      createdAt: now,
      archived: false,
    },
    {
      id: 'seed-core',
      title: 'Core circuit',
      detail: 'Planks, dead bugs, hollow holds.',
      kind: 'reps',
      target: 60,
      accent: 'amber',
      icon: 'barbell',
      reminder: { enabled: false, hour: 20, minute: 0, notificationId: null },
      createdAt: now,
      archived: false,
    },
    {
      id: 'seed-mobility',
      title: 'Mobility reset',
      detail: 'Ten minutes of hips, ankles, thoracic.',
      kind: 'check',
      target: 1,
      accent: 'lime',
      icon: 'body',
      reminder: { enabled: false, hour: 21, minute: 30, notificationId: null },
      createdAt: now,
      archived: false,
    },
  ];
}

export function createInitialState(): AppState {
  const now = new Date().toISOString();
  return {
    version: STATE_VERSION,
    goals: starterGoals(now),
    log: {},
    runs: [],
    plan: {
      currentState: 'Developing',
      goal: 'Press-resistant control',
      hoursPerDay: 1,
      daysPerWeek: 5,
    },
    victories: createVictoryState(),
    updatedAt: Date.now(),
  };
}

/**
 * Victory state arriving from disk or the server is untrusted: a v1 account has
 * none at all, and a future client could send slots this build does not know.
 * Every boolean is coerced and every unknown key dropped, so one bad payload
 * cannot poison the dashboard.
 */
function migrateVictories(raw: unknown): VictoryState {
  if (!raw || typeof raw !== 'object') return createVictoryState();
  const value = raw as Partial<VictoryState>;

  const targets = defaultVictoryTargets();
  if (value.targets && typeof value.targets === 'object') {
    for (const key of Object.keys(targets) as (keyof typeof targets)[]) {
      const stored = (value.targets as Record<string, unknown>)[key];
      if (typeof stored === 'string' && stored.trim()) targets[key] = stored.trim();
    }
  }

  const log: VictoryLog = {};
  if (value.log && typeof value.log === 'object') {
    for (const [day, stored] of Object.entries(value.log as Record<string, unknown>)) {
      if (!stored || typeof stored !== 'object') continue;
      const source = stored as Partial<VictoryDay>;
      const next = emptyVictoryDay();

      for (const group of Object.keys(next) as (keyof VictoryDay)[]) {
        const storedGroup = source[group];
        if (!storedGroup || typeof storedGroup !== 'object') continue;
        for (const slot of Object.keys(next[group])) {
          if ((storedGroup as Record<string, unknown>)[slot] === true) {
            (next[group] as Record<string, boolean>)[slot] = true;
          }
        }
      }
      log[day] = next;
    }
  }

  return { targets, log };
}

/** Forward-compatible load: unknown/older shapes fall back to sane defaults. */
export function migrate(raw: unknown): AppState {
  const base = createInitialState();
  if (!raw || typeof raw !== 'object') return base;
  const value = raw as Partial<AppState>;

  return {
    version: STATE_VERSION,
    goals: Array.isArray(value.goals) ? value.goals : base.goals,
    log: value.log && typeof value.log === 'object' ? value.log : {},
    runs: Array.isArray(value.runs) ? value.runs : [],
    plan: { ...base.plan, ...(value.plan ?? {}) },
    victories: migrateVictories(value.victories),
    updatedAt: Number(value.updatedAt) || 0,
  };
}

/**
 * One-tap presets. The blank-page problem is the main reason habit apps get
 * uninstalled on day one, so adding a sensible goal has to take one tap.
 */
export const GOAL_TEMPLATES: Array<
  Pick<Goal, 'title' | 'detail' | 'kind' | 'target' | 'accent' | 'icon'> & {
    reminder: { enabled: boolean; hour: number; minute: number };
  }
> = [
  {
    title: 'Morning run',
    detail: 'Get the first kilometre out of the way early.',
    kind: 'distance',
    target: 5000,
    accent: 'cyan',
    icon: 'walk',
    reminder: { enabled: true, hour: 7, minute: 0 },
  },
  {
    title: 'Strength block',
    detail: 'Push, pull, legs — pick one and finish it.',
    kind: 'minutes',
    target: 45,
    accent: 'violet',
    icon: 'barbell',
    reminder: { enabled: true, hour: 18, minute: 0 },
  },
  {
    title: 'Push-ups',
    detail: 'Spread them across the day.',
    kind: 'reps',
    target: 100,
    accent: 'rose',
    icon: 'flame',
    reminder: { enabled: false, hour: 12, minute: 0 },
  },
  {
    title: 'Water',
    detail: 'Eight glasses, no excuses.',
    kind: 'reps',
    target: 8,
    accent: 'cyan',
    icon: 'water',
    reminder: { enabled: false, hour: 10, minute: 0 },
  },
  {
    title: 'Stretch',
    detail: 'Ten quiet minutes before bed.',
    kind: 'check',
    target: 1,
    accent: 'lime',
    icon: 'body',
    reminder: { enabled: true, hour: 21, minute: 30 },
  },
  {
    title: 'Sleep by 23:00',
    detail: 'Recovery is training too.',
    kind: 'check',
    target: 1,
    accent: 'amber',
    icon: 'moon',
    reminder: { enabled: true, hour: 22, minute: 30 },
  },
];

export const GOAL_ICONS = [
  'walk',
  'football',
  'barbell',
  'body',
  'bicycle',
  'water',
  'moon',
  'flame',
  'heart',
  'timer',
] as const;
