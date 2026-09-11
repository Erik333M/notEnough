/**
 * Training-group reducer.
 *
 * A sub-reducer of the app reducer in state/DataContext, like the journey
 * slice. Same house rule: **return the same object when nothing changed**, so
 * the caller can skip the `updatedAt` stamp, the disk write and the sync push
 * on a no-op edit.
 *
 * Deletes cascade here rather than in the UI. A group owns its players and
 * plans; a plan owns its tasks; a task and a player each own the assignments
 * that point at them. Leaving orphans behind would corrupt every count on
 * every screen.
 */

import type {
  Assignment,
  GroupState,
  PlanTask,
  Player,
  TrainingGroup,
  TrainingPlan,
} from './types';

export type GroupAction =
  | { type: 'group/add'; group: TrainingGroup }
  | { type: 'group/update'; id: string; patch: Partial<TrainingGroup> }
  | { type: 'group/delete'; id: string }
  | { type: 'player/add'; player: Player }
  | { type: 'player/update'; id: string; patch: Partial<Player> }
  | { type: 'player/delete'; id: string }
  | { type: 'plan/add'; plan: TrainingPlan }
  | { type: 'plan/update'; id: string; patch: Partial<TrainingPlan> }
  | { type: 'plan/delete'; id: string }
  | { type: 'task/add'; task: PlanTask }
  | { type: 'task/update'; id: string; patch: Partial<PlanTask> }
  | { type: 'task/delete'; id: string }
  | { type: 'task/reorder'; planId: string; orderedIds: string[] }
  | { type: 'assignment/add'; assignments: Assignment[] }
  | { type: 'assignment/update'; id: string; patch: Partial<Assignment> }
  | { type: 'assignment/delete'; id: string };

function patchById<T extends { id: string }>(rows: T[], id: string, patch: Partial<T>): T[] {
  const index = rows.findIndex((row) => row.id === id);
  if (index === -1) return rows;
  const next = rows.slice();
  next[index] = { ...next[index], ...patch, id };
  return next;
}

function removeById<T extends { id: string }>(rows: T[], id: string): T[] {
  const next = rows.filter((row) => row.id !== id);
  return next.length === rows.length ? rows : next;
}

export function groupReducer(state: GroupState, action: GroupAction): GroupState {
  switch (action.type) {
    case 'group/add':
      return { ...state, groups: [action.group, ...state.groups] };

    case 'group/update': {
      const groups = patchById(state.groups, action.id, action.patch);
      return groups === state.groups ? state : { ...state, groups };
    }

    case 'group/delete': {
      const groups = removeById(state.groups, action.id);
      if (groups === state.groups) return state;

      const players = state.players.filter((p) => p.groupId !== action.id);
      const plans = state.plans.filter((p) => p.groupId !== action.id);
      const planIds = new Set(plans.map((p) => p.id));
      const tasks = state.tasks.filter((t) => planIds.has(t.planId));
      const taskIds = new Set(tasks.map((t) => t.id));
      const playerIds = new Set(players.map((p) => p.id));

      return {
        ...state,
        groups,
        players,
        plans,
        tasks,
        assignments: state.assignments.filter(
          (a) => taskIds.has(a.taskId) && playerIds.has(a.playerId),
        ),
      };
    }

    case 'player/add':
      return { ...state, players: [...state.players, action.player] };

    case 'player/update': {
      const players = patchById(state.players, action.id, action.patch);
      return players === state.players ? state : { ...state, players };
    }

    case 'player/delete': {
      const players = removeById(state.players, action.id);
      if (players === state.players) return state;
      return {
        ...state,
        players,
        assignments: state.assignments.filter((a) => a.playerId !== action.id),
      };
    }

    case 'plan/add':
      return { ...state, plans: [...state.plans, action.plan] };

    case 'plan/update': {
      const plans = patchById(state.plans, action.id, action.patch);
      return plans === state.plans ? state : { ...state, plans };
    }

    case 'plan/delete': {
      const plans = removeById(state.plans, action.id);
      if (plans === state.plans) return state;

      const tasks = state.tasks.filter((t) => t.planId !== action.id);
      const taskIds = new Set(tasks.map((t) => t.id));
      return {
        ...state,
        plans,
        tasks,
        assignments: state.assignments.filter((a) => taskIds.has(a.taskId)),
      };
    }

    case 'task/add':
      return { ...state, tasks: [...state.tasks, action.task] };

    case 'task/update': {
      const tasks = patchById(state.tasks, action.id, action.patch);
      return tasks === state.tasks ? state : { ...state, tasks };
    }

    case 'task/delete': {
      const tasks = removeById(state.tasks, action.id);
      if (tasks === state.tasks) return state;
      return {
        ...state,
        tasks,
        assignments: state.assignments.filter((a) => a.taskId !== action.id),
      };
    }

    case 'task/reorder': {
      // Position is stored, so a reorder is a write. Anything not named keeps
      // the order it had, which makes a partial list safe to pass.
      const position = new Map(action.orderedIds.map((id, index) => [id, index]));
      let changed = false;
      const tasks = state.tasks.map((task) => {
        if (task.planId !== action.planId) return task;
        const next = position.get(task.id);
        if (next === undefined || next === task.order) return task;
        changed = true;
        return { ...task, order: next };
      });
      return changed ? { ...state, tasks } : state;
    }

    case 'assignment/add':
      // Added in bulk: assigning one task to a squad is one action, not one
      // per player, so the whole squad lands in a single state update.
      return action.assignments.length === 0
        ? state
        : { ...state, assignments: [...state.assignments, ...action.assignments] };

    case 'assignment/update': {
      const assignments = patchById(state.assignments, action.id, {
        ...action.patch,
        updatedAt: Date.now(),
      });
      return assignments === state.assignments ? state : { ...state, assignments };
    }

    case 'assignment/delete': {
      const assignments = removeById(state.assignments, action.id);
      return assignments === state.assignments ? state : { ...state, assignments };
    }

    default:
      return state;
  }
}
