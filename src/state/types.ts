import type { Ionicons } from '@expo/vector-icons';
import type { AccentName } from '../theme/theme';

export type IconName = keyof typeof Ionicons.glyphMap;

export type GoalKind = 'minutes' | 'reps' | 'distance' | 'check';

export type Reminder = {
  enabled: boolean;
  hour: number;
  minute: number;
  /** Identifier returned by expo-notifications, so we can cancel precisely. */
  notificationId: string | null;
};

export type Goal = {
  id: string;
  title: string;
  detail: string;
  kind: GoalKind;
  /** minutes | reps | metres | 1 for a simple check-off */
  target: number;
  accent: AccentName;
  icon: IconName;
  reminder: Reminder;
  createdAt: string;
  archived: boolean;
};

/** dayKey -> goalId -> amount completed that day. */
export type ProgressLog = Record<string, Record<string, number>>;

export type RunMode = 'stopwatch' | 'interval';

export type RunSession = {
  id: string;
  startedAt: string;
  durationMs: number;
  distanceM: number;
  laps: number[];
  mode: RunMode;
};

export type SkillLevel = 'Starter' | 'Developing' | 'Advanced';
export type GoalLevel =
  | 'Reliable match control'
  | 'Press-resistant control'
  | 'Elite first touch';

export type PlanConfig = {
  currentState: SkillLevel;
  goal: GoalLevel;
  hoursPerDay: number;
  daysPerWeek: number;
};

/* ------------------------------------------------------------- 3 victories */

/** BODY → MIND → SPIRIT. The order is the visual hierarchy, so it is fixed. */
export type VictoryKey = 'physical' | 'mind' | 'spiritual';

export type PhysicalSlot = 'hygiene' | 'strength' | 'recovery';
export type MindSlot = 'deepWork' | 'learn' | 'reflection';
export type SpiritualSlot = 'prayer' | 'scripture' | 'faith';

/** The nine slots are a closed set — users customise targets, never the slots. */
export type VictoryGoalKey = PhysicalSlot | MindSlot | SpiritualSlot;

/**
 * One day's completion, stored exactly as it reads: three victories of three
 * goals. Nested rather than flat so a stored day is self-describing.
 */
export type VictoryDay = {
  physical: Record<PhysicalSlot, boolean>;
  mind: Record<MindSlot, boolean>;
  spiritual: Record<SpiritualSlot, boolean>;
};

/** dayKey -> that day's nine booleans. Past days are only ever added to. */
export type VictoryLog = Record<string, VictoryDay>;

/**
 * The user's custom target line per slot ("30 push-ups", "Read 20 pages").
 * Title and description come from the fixed catalogue; only this is editable.
 */
export type VictoryTargets = Record<VictoryGoalKey, string>;

export type VictoryState = {
  targets: VictoryTargets;
  log: VictoryLog;
};

export type AppState = {
  version: number;
  goals: Goal[];
  log: ProgressLog;
  runs: RunSession[];
  plan: PlanConfig;
  victories: VictoryState;
  /**
   * Epoch ms of the last local mutation. This is the only input to the
   * last-write-wins rule the server enforces, so every mutating action must
   * bump it — the reducer wrapper does that centrally.
   */
  updatedAt: number;
};

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  salt: string;
  hash: string;
  createdAt: string;
};

export type PublicUser = Pick<UserRecord, 'id' | 'email' | 'name' | 'createdAt'>;

export type Session = {
  userId: string;
  issuedAt: string;
};

export const GOAL_UNIT: Record<GoalKind, string> = {
  minutes: 'min',
  reps: 'reps',
  distance: 'm',
  check: 'done',
};
