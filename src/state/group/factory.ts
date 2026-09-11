/**
 * Constructors for every training-group shape.
 *
 * Kept apart from the readers so there is one definition of "new" in the
 * feature: a freshly created record and one repaired from disk are built by
 * the same functions and cannot drift.
 */

import { makeId } from '../../lib/crypto';
import type {
  Assignment,
  DayKey,
  GroupState,
  PlanTask,
  Player,
  PlayerLevel,
  TaskKind,
  TrainingGroup,
  TrainingPlan,
} from './types';

/** Unambiguous alphabet: no O/0, I/1, or similar, since these get read aloud. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * A short join code for a group.
 *
 * Not a secret and not used yet — see the note on `TrainingGroup.inviteCode`.
 * Six characters from a 32-letter alphabet is roughly a billion combinations,
 * which is ample for codes a trainer reads out and a server would rate-limit.
 */
export function makeInviteCode(): string {
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function createGroup(name: string, notes = ''): TrainingGroup {
  return {
    id: makeId(),
    name,
    notes,
    inviteCode: makeInviteCode(),
    createdAt: Date.now(),
    archived: false,
  };
}

export function createPlayer(
  groupId: string,
  name: string,
  level: PlayerLevel = 'Starter',
): Player {
  return {
    id: makeId(),
    groupId,
    name,
    level,
    role: '',
    notes: '',
    // No player logins yet; see the note on the field itself.
    linkedUserId: null,
    createdAt: Date.now(),
    archived: false,
  };
}

export function createPlan(groupId: string, name: string, notes = ''): TrainingPlan {
  return {
    id: makeId(),
    groupId,
    name,
    notes,
    createdAt: Date.now(),
    archived: false,
  };
}

/** Sensible target per unit, so adding a task never starts at zero. */
export const DEFAULT_TARGET: Record<TaskKind, number> = {
  check: 1,
  reps: 20,
  minutes: 15,
  distance: 1000,
};

export function createTask(planId: string, title: string, kind: TaskKind, order: number): PlanTask {
  return {
    id: makeId(),
    planId,
    title,
    detail: '',
    kind,
    target: DEFAULT_TARGET[kind],
    order,
  };
}

export function createAssignment(taskId: string, playerId: string, dueDate: DayKey): Assignment {
  const now = Date.now();
  return {
    id: makeId(),
    taskId,
    playerId,
    dueDate,
    amount: 0,
    done: false,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function createGroupState(schemaVersion: number): GroupState {
  return {
    schemaVersion,
    groups: [],
    players: [],
    plans: [],
    tasks: [],
    assignments: [],
  };
}
