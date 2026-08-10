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

export type AppState = {
  version: number;
  goals: Goal[];
  log: ProgressLog;
  runs: RunSession[];
  plan: PlanConfig;
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
