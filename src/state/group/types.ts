/**
 * Training groups — every domain type for the feature, in one place.
 *
 * A trainer runs groups. A group has a roster of players and a set of plans.
 * A plan is made of tasks, and a task becomes an assignment when it is given
 * to a player for a date. Progress lives on the assignment.
 *
 * Everything here is local to the trainer's own account. There is no player
 * login yet, so a `Player` is a record the trainer typed in rather than a
 * person who can sign in — see `linkedUserId` for how that changes later.
 */

import type { SkillLevel } from '../types';

/** A local-time `YYYY-MM-DD`, same opaque key the rest of the app uses. */
export type DayKey = string;

export type Timestamp = number;

/** Reuses the app's existing ladder rather than inventing a second one. */
export type PlayerLevel = SkillLevel;

export const PLAYER_LEVELS: readonly PlayerLevel[] = ['Starter', 'Developing', 'Advanced'];

/* --------------------------------------------------------------------- group */

export type TrainingGroup = {
  id: string;
  name: string;
  /** Free text: age band, season, whatever the trainer needs. */
  notes: string;
  /**
   * Generated now, unused now.
   *
   * When players can sign in, this is how they join a group without the
   * trainer being able to look up an account by email. Storing it from the
   * start means that release needs no migration; nothing displays it yet,
   * because nothing can act on it.
   */
  inviteCode: string;
  createdAt: Timestamp;
  /** Groups archive rather than delete, so their history survives. */
  archived: boolean;
};

/* -------------------------------------------------------------------- player */

export type Player = {
  id: string;
  groupId: string;
  name: string;
  level: PlayerLevel;
  /** Position, event, weight class — whatever the sport calls it. */
  role: string;
  notes: string;
  /**
   * The account this player record belongs to, once player logins exist.
   *
   * Null for every record today: these are entries a trainer typed in, not
   * people with accounts. The field exists so linking a real user later is an
   * update rather than a schema change.
   */
  linkedUserId: string | null;
  createdAt: Timestamp;
  archived: boolean;
};

/* ---------------------------------------------------------------------- plan */

export type TrainingPlan = {
  id: string;
  groupId: string;
  name: string;
  notes: string;
  createdAt: Timestamp;
  archived: boolean;
};

/**
 * How a task is measured. Mirrors the app's existing `GoalKind` vocabulary so
 * a trainer and a player are counting the same things in the same words.
 */
export type TaskKind = 'check' | 'reps' | 'minutes' | 'distance';

export const TASK_KINDS: readonly TaskKind[] = ['check', 'reps', 'minutes', 'distance'];

/**
 * A unit of work inside a plan — the template, not the doing of it.
 *
 * Separate from `Assignment` so the same task can go to a whole squad without
 * being duplicated per player, and so editing the task later does not rewrite
 * what each player was actually set.
 */
export type PlanTask = {
  id: string;
  planId: string;
  title: string;
  detail: string;
  kind: TaskKind;
  /** Reps, minutes or metres. 1 for a plain check-off. */
  target: number;
  /** Position within its plan. Explicit so reordering is a data change. */
  order: number;
};

/* ---------------------------------------------------------------- assignment */

/**
 * One task, given to one player, for one date.
 *
 * Progress sits here rather than in a separate completions table: in a
 * trainer-recorded feature there is exactly one writer, so per-event rows
 * would buy nothing and cost a join on every screen.
 */
export type Assignment = {
  id: string;
  taskId: string;
  playerId: string;
  dueDate: DayKey;
  /** Progress in the task's own unit. */
  amount: number;
  /**
   * Explicitly marked done.
   *
   * Kept apart from `amount >= target` because a trainer can call something
   * finished that fell short — an injury, a shortened session — and that
   * judgement should survive rather than be recomputed away.
   */
  done: boolean;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/* --------------------------------------------------------------------- state */

/**
 * The feature's slice of `AppState`.
 *
 * Flat lists keyed by id rather than nested objects: a task moving between
 * plans, or a player between groups, is then a field change instead of a
 * restructure. Screens do the grouping in selectors.
 */
export type GroupState = {
  schemaVersion: number;
  groups: TrainingGroup[];
  players: Player[];
  plans: TrainingPlan[];
  tasks: PlanTask[];
  assignments: Assignment[];
};
