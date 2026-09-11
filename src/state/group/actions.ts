/**
 * Action creators for the training-group slice.
 *
 * Built once from `dispatch` and handed to screens through `DataContext`, the
 * same way the journey actions are. These wrap record construction so a screen
 * never mints an id or a timestamp by hand.
 */

import { createAssignment, createGroup, createPlan, createPlayer, createTask } from './factory';
import type { GroupAction } from './reducer';
import type {
  Assignment,
  DayKey,
  PlanTask,
  Player,
  PlayerLevel,
  TaskKind,
  TrainingGroup,
  TrainingPlan,
} from './types';

export type GroupDispatch = (action: GroupAction) => void;

export type GroupActions = {
  addGroup: (name: string, notes?: string) => TrainingGroup;
  updateGroup: (id: string, patch: Partial<TrainingGroup>) => void;
  deleteGroup: (id: string) => void;

  addPlayer: (groupId: string, name: string, level?: PlayerLevel) => Player;
  updatePlayer: (id: string, patch: Partial<Player>) => void;
  deletePlayer: (id: string) => void;

  addPlan: (groupId: string, name: string, notes?: string) => TrainingPlan;
  updatePlan: (id: string, patch: Partial<TrainingPlan>) => void;
  deletePlan: (id: string) => void;

  addTask: (planId: string, title: string, kind: TaskKind, order: number) => PlanTask;
  updateTask: (id: string, patch: Partial<PlanTask>) => void;
  deleteTask: (id: string) => void;
  reorderTasks: (planId: string, orderedIds: string[]) => void;

  /** Gives one task to many players at once. Returns what was created. */
  assignTask: (taskId: string, playerIds: string[], dueDate: DayKey) => Assignment[];
  setProgress: (id: string, amount: number) => void;
  setDone: (id: string, done: boolean) => void;
  updateAssignment: (id: string, patch: Partial<Assignment>) => void;
  deleteAssignment: (id: string) => void;
};

export function createGroupActions(dispatch: GroupDispatch): GroupActions {
  return {
    addGroup(name, notes = '') {
      const group = createGroup(name.trim(), notes.trim());
      dispatch({ type: 'group/add', group });
      return group;
    },
    updateGroup(id, patch) {
      dispatch({ type: 'group/update', id, patch });
    },
    deleteGroup(id) {
      dispatch({ type: 'group/delete', id });
    },

    addPlayer(groupId, name, level = 'Starter') {
      const player = createPlayer(groupId, name.trim(), level);
      dispatch({ type: 'player/add', player });
      return player;
    },
    updatePlayer(id, patch) {
      dispatch({ type: 'player/update', id, patch });
    },
    deletePlayer(id) {
      dispatch({ type: 'player/delete', id });
    },

    addPlan(groupId, name, notes = '') {
      const plan = createPlan(groupId, name.trim(), notes.trim());
      dispatch({ type: 'plan/add', plan });
      return plan;
    },
    updatePlan(id, patch) {
      dispatch({ type: 'plan/update', id, patch });
    },
    deletePlan(id) {
      dispatch({ type: 'plan/delete', id });
    },

    addTask(planId, title, kind, order) {
      const task = createTask(planId, title.trim(), kind, order);
      dispatch({ type: 'task/add', task });
      return task;
    },
    updateTask(id, patch) {
      dispatch({ type: 'task/update', id, patch });
    },
    deleteTask(id) {
      dispatch({ type: 'task/delete', id });
    },
    reorderTasks(planId, orderedIds) {
      dispatch({ type: 'task/reorder', planId, orderedIds });
    },

    assignTask(taskId, playerIds, dueDate) {
      const assignments = playerIds.map((playerId) =>
        createAssignment(taskId, playerId, dueDate),
      );
      dispatch({ type: 'assignment/add', assignments });
      return assignments;
    },
    setProgress(id, amount) {
      dispatch({ type: 'assignment/update', id, patch: { amount: Math.max(0, amount) } });
    },
    setDone(id, done) {
      dispatch({ type: 'assignment/update', id, patch: { done } });
    },
    updateAssignment(id, patch) {
      dispatch({ type: 'assignment/update', id, patch });
    },
    deleteAssignment(id) {
      dispatch({ type: 'assignment/delete', id });
    },
  };
}
