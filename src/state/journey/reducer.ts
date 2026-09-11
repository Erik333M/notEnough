/**
 * Success Journey reducer.
 *
 * A sub-reducer of the app reducer in state/DataContext, not a second store:
 * `DataContext` owns dispatch, persistence and sync, and forwards a
 * `JourneyAction` here. That keeps one source of truth and one `updatedAt`
 * stamp for the whole app.
 *
 * House rule inherited from the app reducer: **return the same object when
 * nothing changed**. The caller uses identity to decide whether to stamp
 * `updatedAt`, so a no-op edit — retyping the same text, tapping a round box
 * that is already off — costs no disk write and no sync push.
 *
 * Daily-entry and workout actions live in entryReducer.ts; what remains here
 * are the flat library shapes, which are added and removed rather than grown.
 */

import { entryReducer, type EntryAction } from './entryReducer';
import type {
  BenchmarkDefinition,
  BenchmarkResult,
  DayKey,
  Habit,
  JourneyState,
  MeasurementBaseline,
  MeasurementEntry,
  Movement,
  UnitSystem,
} from './types';

export type { EntryTextField, IntentionSlot, WodTextField } from './entryReducer';

/** Everything that is not a daily entry: catalogues, results and ticks. */
export type LibraryAction =
  /* movements */
  | { type: 'movement/add'; movement: Movement }
  | { type: 'movement/update'; id: string; patch: Partial<Movement> }
  | { type: 'movement/delete'; id: string }
  /* benchmarks */
  | { type: 'benchmark/add'; definition: BenchmarkDefinition }
  | { type: 'benchmark/delete'; id: string }
  | { type: 'benchmark/addResult'; result: BenchmarkResult }
  | { type: 'benchmark/updateResult'; id: string; patch: Partial<BenchmarkResult> }
  | { type: 'benchmark/deleteResult'; id: string }
  /* measurements */
  | { type: 'measurement/setBaseline'; patch: Partial<MeasurementBaseline> }
  | { type: 'measurement/add'; entry: MeasurementEntry }
  | { type: 'measurement/update'; id: string; patch: Partial<MeasurementEntry> }
  | { type: 'measurement/delete'; id: string }
  | { type: 'measurement/setUnits'; units: UnitSystem }
  /* habits */
  | { type: 'habit/add'; habit: Habit }
  | { type: 'habit/update'; id: string; patch: Partial<Habit> }
  | { type: 'habit/archive'; id: string }
  | { type: 'habit/toggleCheck'; date: DayKey; habitId: string };

export type JourneyAction = EntryAction | LibraryAction;

/** Replaces one row of a list by id, or returns the same list if absent. */
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

/** Discriminates on the action's namespace prefix. */
function isEntryAction(action: JourneyAction): action is EntryAction {
  return action.type.startsWith('entry/') || action.type.startsWith('wod/');
}

export function journeyReducer(state: JourneyState, action: JourneyAction): JourneyState {
  if (isEntryAction(action)) return entryReducer(state, action);

  switch (action.type) {
    case 'movement/add':
      return { ...state, movements: [action.movement, ...state.movements] };

    case 'movement/update': {
      const movements = patchById(state.movements, action.id, action.patch);
      return movements === state.movements ? state : { ...state, movements };
    }

    case 'movement/delete': {
      // Only custom movements are stored, so this cannot remove a seeded one.
      // WOD lines referencing it keep their `freeText`, which is exactly why
      // the line stores both.
      const movements = removeById(state.movements, action.id);
      return movements === state.movements ? state : { ...state, movements };
    }

    case 'benchmark/add':
      return { ...state, benchmarks: [action.definition, ...state.benchmarks] };

    case 'benchmark/delete': {
      const benchmarks = removeById(state.benchmarks, action.id);
      if (benchmarks === state.benchmarks) return state;
      // Its results go too — an orphaned result can never be read again.
      return {
        ...state,
        benchmarks,
        results: state.results.filter((r) => r.definitionId !== action.id),
      };
    }

    case 'benchmark/addResult':
      return { ...state, results: [action.result, ...state.results] };

    case 'benchmark/updateResult': {
      const results = patchById(state.results, action.id, action.patch);
      return results === state.results ? state : { ...state, results };
    }

    case 'benchmark/deleteResult': {
      const results = removeById(state.results, action.id);
      return results === state.results ? state : { ...state, results };
    }

    case 'measurement/setBaseline': {
      const baseline = { ...state.baseline, ...action.patch };
      return { ...state, baseline };
    }

    case 'measurement/add':
      return { ...state, measurements: [action.entry, ...state.measurements] };

    case 'measurement/update': {
      const measurements = patchById(state.measurements, action.id, action.patch);
      return measurements === state.measurements ? state : { ...state, measurements };
    }

    case 'measurement/delete': {
      const measurements = removeById(state.measurements, action.id);
      return measurements === state.measurements ? state : { ...state, measurements };
    }

    case 'measurement/setUnits':
      // Display-only: stored values stay canonical, so flipping this back and
      // forth can never round a weight away.
      return state.units === action.units ? state : { ...state, units: action.units };

    case 'habit/add':
      return { ...state, habits: [...state.habits, action.habit] };

    case 'habit/update': {
      const habits = patchById(state.habits, action.id, action.patch);
      return habits === state.habits ? state : { ...state, habits };
    }

    case 'habit/archive': {
      // Archive rather than delete: the habit leaves the list, its ticks stay
      // in the history they belong to.
      const habits = patchById(state.habits, action.id, { archived: true });
      return habits === state.habits ? state : { ...state, habits };
    }

    case 'habit/toggleCheck': {
      const day = state.checks[action.date];
      const checks = { ...state.checks };

      if (day?.[action.habitId]) {
        const next = { ...day };
        delete next[action.habitId];
        // Drop the day entirely once its last tick is gone, so the map holds
        // only days that actually mean something.
        if (Object.keys(next).length === 0) delete checks[action.date];
        else checks[action.date] = next;
      } else {
        checks[action.date] = { ...day, [action.habitId]: true };
      }
      return { ...state, checks };
    }

    default:
      return state;
  }
}
