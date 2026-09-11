/**
 * Reading the training-group slice.
 *
 * The state is flat lists, so the shaping happens here. Everything is a pure
 * read: nothing in this file creates a record, so opening a screen can never
 * write.
 */

import type {
  Assignment,
  DayKey,
  GroupState,
  PlanTask,
  Player,
  TrainingGroup,
  TrainingPlan,
} from './types';

export function activeGroups(state: GroupState): TrainingGroup[] {
  return state.groups.filter((g) => !g.archived);
}

export function groupById(state: GroupState, id: string): TrainingGroup | null {
  return state.groups.find((g) => g.id === id) ?? null;
}

/** A group's roster, alphabetical — the order a trainer scans a team sheet. */
export function playersInGroup(state: GroupState, groupId: string): Player[] {
  return state.players
    .filter((p) => p.groupId === groupId && !p.archived)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function playerById(state: GroupState, id: string): Player | null {
  return state.players.find((p) => p.id === id) ?? null;
}

export function plansInGroup(state: GroupState, groupId: string): TrainingPlan[] {
  return state.plans.filter((p) => p.groupId === groupId && !p.archived);
}

export function planById(state: GroupState, id: string): TrainingPlan | null {
  return state.plans.find((p) => p.id === id) ?? null;
}

/** A plan's tasks in their stored order. */
export function tasksInPlan(state: GroupState, planId: string): PlanTask[] {
  return state.tasks.filter((t) => t.planId === planId).sort((a, b) => a.order - b.order);
}

export function taskById(state: GroupState, id: string): PlanTask | null {
  return state.tasks.find((t) => t.id === id) ?? null;
}

/** Everything set for one player, newest due date first. */
export function assignmentsForPlayer(state: GroupState, playerId: string): Assignment[] {
  return state.assignments
    .filter((a) => a.playerId === playerId)
    .sort((a, b) => (a.dueDate < b.dueDate ? 1 : a.dueDate > b.dueDate ? -1 : 0));
}

export function assignmentsForDate(
  state: GroupState,
  playerId: string,
  date: DayKey,
): Assignment[] {
  return state.assignments.filter((a) => a.playerId === playerId && a.dueDate === date);
}

/** Who already has this task on this date — so assigning twice is preventable. */
export function assignedPlayerIds(state: GroupState, taskId: string, date: DayKey): Set<string> {
  const out = new Set<string>();
  for (const a of state.assignments) {
    if (a.taskId === taskId && a.dueDate === date) out.add(a.playerId);
  }
  return out;
}

/**
 * Whether an assignment counts as finished.
 *
 * An explicit `done` always wins, including when it undershoots the target —
 * a trainer calling a shortened session complete is a judgement the app should
 * keep rather than recompute away.
 */
export function isComplete(assignment: Assignment, task: PlanTask | null): boolean {
  if (assignment.done) return true;
  if (!task || task.target <= 0) return false;
  return assignment.amount >= task.target;
}

export type Progress = { total: number; complete: number; ratio: number };

function summarise(
  state: GroupState,
  assignments: Assignment[],
): Progress {
  if (assignments.length === 0) return { total: 0, complete: 0, ratio: 0 };
  let complete = 0;
  for (const a of assignments) {
    if (isComplete(a, taskById(state, a.taskId))) complete += 1;
  }
  return {
    total: assignments.length,
    complete,
    ratio: complete / assignments.length,
  };
}

/** One player's completion across everything ever set for them. */
export function playerProgress(state: GroupState, playerId: string): Progress {
  return summarise(state, assignmentsForPlayer(state, playerId));
}

/** A whole group's completion, across every player in it. */
export function groupProgress(state: GroupState, groupId: string): Progress {
  const playerIds = new Set(playersInGroup(state, groupId).map((p) => p.id));
  return summarise(
    state,
    state.assignments.filter((a) => playerIds.has(a.playerId)),
  );
}

/** Counts for a group card, computed in one pass rather than three. */
export type GroupSummary = {
  players: number;
  plans: number;
  progress: Progress;
};

export function groupSummary(state: GroupState, groupId: string): GroupSummary {
  return {
    players: playersInGroup(state, groupId).length,
    plans: plansInGroup(state, groupId).length,
    progress: groupProgress(state, groupId),
  };
}
