/**
 * Training-group persistence boundary.
 *
 * `migrateGroups()` is the only way this slice enters the app, and it is
 * total: undefined, a scalar, corrupt JSON or a payload from a future build
 * all yield a valid `GroupState`. Nothing downstream re-validates.
 *
 * Adding a version: bump the constant, add a `case` to `upgrade()`, leave the
 * readers alone unless a field's type changed. Versions run in sequence.
 */

import { asNumber, isRecord } from '../journey/coerce';
import { createGroupState } from './factory';
import {
  readAssignment,
  readGroup,
  readList,
  readPlan,
  readPlayer,
  readTask,
} from './readers';
import type { GroupState } from './types';

export const GROUP_SCHEMA_VERSION = 1;

/**
 * Caps. Far above any real squad, present so a corrupt or hostile payload
 * cannot make the app allocate without bound on launch.
 */
const LIMITS = {
  groups: 200,
  players: 2000,
  plans: 1000,
  tasks: 10000,
  assignments: 50000,
} as const;

function storedVersion(raw: Record<string, unknown>): number {
  const version = asNumber(raw.schemaVersion, 1);
  return version >= 1 ? Math.floor(version) : 1;
}

/**
 * Sequential per-version transforms. Empty at v1 — it exists so the first
 * migration is a three-line diff rather than a refactor.
 */
function upgrade(state: GroupState, from: number): GroupState {
  let next = state;
  for (let version = from; version < GROUP_SCHEMA_VERSION; version += 1) {
    switch (version) {
      // case 1: next = { ...next, someNewField: default }; break;
      default:
        break;
    }
  }
  return { ...next, schemaVersion: GROUP_SCHEMA_VERSION };
}

/**
 * Drops rows whose parent is gone.
 *
 * Deleting a group already removes its children in the reducer, but a payload
 * can arrive from an older build, a partial sync or a hand-edited file. An
 * orphan is unreachable in every screen and would only ever show up as a
 * miscount, so it is cheaper to discard it here than to guard every selector.
 */
function pruneOrphans(state: GroupState): GroupState {
  const groupIds = new Set(state.groups.map((g) => g.id));
  const players = state.players.filter((p) => groupIds.has(p.groupId));
  const plans = state.plans.filter((p) => groupIds.has(p.groupId));

  const planIds = new Set(plans.map((p) => p.id));
  const tasks = state.tasks.filter((t) => planIds.has(t.planId));

  const taskIds = new Set(tasks.map((t) => t.id));
  const playerIds = new Set(players.map((p) => p.id));
  const assignments = state.assignments.filter(
    (a) => taskIds.has(a.taskId) && playerIds.has(a.playerId),
  );

  return { ...state, players, plans, tasks, assignments };
}

export function migrateGroups(raw: unknown): GroupState {
  const fresh = createGroupState(GROUP_SCHEMA_VERSION);
  if (!isRecord(raw)) return fresh;

  const from = storedVersion(raw);

  const parsed: GroupState = {
    schemaVersion: from,
    groups: readList(raw.groups, readGroup, LIMITS.groups),
    players: readList(raw.players, readPlayer, LIMITS.players),
    plans: readList(raw.plans, readPlan, LIMITS.plans),
    tasks: readList(raw.tasks, readTask, LIMITS.tasks),
    assignments: readList(raw.assignments, readAssignment, LIMITS.assignments),
  };

  return upgrade(pruneOrphans(parsed), from);
}
