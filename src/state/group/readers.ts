/**
 * `unknown` -> training-group shapes.
 *
 * Same boundary discipline as the rest of the app: hand-rolled coercion, never
 * throws, and a row the reader cannot make sense of is dropped rather than
 * allowed through half-formed. Anything that reaches a screen from here is
 * already valid.
 */

import { makeId } from '../../lib/crypto';
import {
  asArray,
  asBool,
  asDayKey,
  asEnum,
  asNumber,
  asString,
  isRecord,
} from '../journey/coerce';
import { makeInviteCode } from './factory';
import { PLAYER_LEVELS, TASK_KINDS } from './types';
import type { Assignment, PlanTask, Player, TrainingGroup, TrainingPlan } from './types';

const NAME_MAX = 80;
const NOTE_MAX = 500;

/** A record with no name cannot be shown or chosen, so it is not a record. */
function named(value: Record<string, unknown>, key = 'name'): string {
  return asString(value[key], '', NAME_MAX).trim();
}

export function readGroup(value: unknown): TrainingGroup | null {
  if (!isRecord(value)) return null;
  const name = named(value);
  if (!name) return null;

  return {
    id: asString(value.id, '', 64) || makeId(),
    name,
    notes: asString(value.notes, '', NOTE_MAX),
    // Older rows predate the field; minting one is harmless and keeps the
    // shape uniform.
    inviteCode: asString(value.inviteCode, '', 16) || makeInviteCode(),
    createdAt: asNumber(value.createdAt, 0),
    archived: asBool(value.archived),
  };
}

export function readPlayer(value: unknown): Player | null {
  if (!isRecord(value)) return null;
  const name = named(value);
  const groupId = asString(value.groupId, '', 64);
  // A player outside a group is unreachable in every screen.
  if (!name || !groupId) return null;

  return {
    id: asString(value.id, '', 64) || makeId(),
    groupId,
    name,
    level: asEnum(value.level, PLAYER_LEVELS, 'Starter'),
    role: asString(value.role, '', NAME_MAX),
    notes: asString(value.notes, '', NOTE_MAX),
    linkedUserId: asString(value.linkedUserId, '', 64) || null,
    createdAt: asNumber(value.createdAt, 0),
    archived: asBool(value.archived),
  };
}

export function readPlan(value: unknown): TrainingPlan | null {
  if (!isRecord(value)) return null;
  const name = named(value);
  const groupId = asString(value.groupId, '', 64);
  if (!name || !groupId) return null;

  return {
    id: asString(value.id, '', 64) || makeId(),
    groupId,
    name,
    notes: asString(value.notes, '', NOTE_MAX),
    createdAt: asNumber(value.createdAt, 0),
    archived: asBool(value.archived),
  };
}

export function readTask(value: unknown): PlanTask | null {
  if (!isRecord(value)) return null;
  const title = asString(value.title, '', NAME_MAX).trim();
  const planId = asString(value.planId, '', 64);
  if (!title || !planId) return null;

  const target = asNumber(value.target, 1);
  return {
    id: asString(value.id, '', 64) || makeId(),
    planId,
    title,
    detail: asString(value.detail, '', NOTE_MAX),
    kind: asEnum(value.kind, TASK_KINDS, 'check'),
    // A non-positive target would make every progress bar divide by zero.
    target: target > 0 ? Math.round(target) : 1,
    order: asNumber(value.order, 0),
  };
}

export function readAssignment(value: unknown): Assignment | null {
  if (!isRecord(value)) return null;
  const taskId = asString(value.taskId, '', 64);
  const playerId = asString(value.playerId, '', 64);
  const dueDate = asDayKey(value.dueDate);
  // Without all three this cannot be attributed to anyone, on any day.
  if (!taskId || !playerId || !dueDate) return null;

  const amount = asNumber(value.amount, 0);
  return {
    id: asString(value.id, '', 64) || makeId(),
    taskId,
    playerId,
    dueDate,
    amount: amount >= 0 ? amount : 0,
    done: asBool(value.done),
    notes: asString(value.notes, '', NOTE_MAX),
    createdAt: asNumber(value.createdAt, 0),
    updatedAt: asNumber(value.updatedAt, 0),
  };
}

/** Maps a list through a reader, dropping rows it rejects. */
export function readList<T>(value: unknown, read: (item: unknown) => T | null, max: number): T[] {
  return asArray(value, read, max);
}
