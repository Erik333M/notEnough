/**
 * Action creators for the Success Journey slice.
 *
 * Built once from `dispatch` and handed to screens through `DataContext`, the
 * same way the app's existing actions are. Every entry action takes an
 * explicit `date` rather than assuming today: the daily editor has to be able
 * to work on any date, and a session left open past midnight must write to the
 * day the user is looking at, not the day the screen mounted on.
 *
 * These wrap object construction (ids, timestamps, unit conversion) so a
 * screen never builds a domain record by hand.
 */

import {
  createHabit,
  createMeasurement,
  createMovement,
  createWodLine,
} from './factory';
import type { JourneyAction, EntryTextField, IntentionSlot, WodTextField } from './reducer';
import type {
  BodyForm,
  BenchmarkDefinition,
  BenchmarkGroup,
  BenchmarkMetric,
  BenchmarkResult,
  DayKey,
  Habit,
  HabitGroup,
  HabitTemplate,
  MeasurementBaseline,
  MeasurementEntry,
  Movement,
  MovementCategory,
  PlusOneKey,
  UnitSystem,
  WodLine,
  WodRounds,
  WodTag,
} from './types';
import { makeId } from '../../lib/crypto';

export type JourneyDispatch = (action: JourneyAction) => void;

export type JourneyActions = {
  /* daily entry */
  setEntryText: (date: DayKey, field: EntryTextField, value: string) => void;
  setIntentionText: (date: DayKey, slot: IntentionSlot, text: string) => void;
  /** Cycles unanswered -> yes -> no -> unanswered, so a mistap is recoverable. */
  cycleIntentionDone: (date: DayKey, slot: IntentionSlot, current: boolean | null) => void;
  setIntentionDone: (date: DayKey, slot: IntentionSlot, done: boolean | null) => void;
  togglePlusOne: (date: DayKey, key: PlusOneKey) => void;
  clearEntry: (date: DayKey) => void;

  /* wod */
  toggleWodTag: (date: DayKey, tag: WodTag) => void;
  setWodRounds: (date: DayKey, rounds: WodRounds | null) => void;
  setWodText: (date: DayKey, field: WodTextField, value: string) => void;
  addWodLine: (date: DayKey) => void;
  updateWodLine: (date: DayKey, id: string, patch: Partial<WodLine>) => void;
  removeWodLine: (date: DayKey, id: string) => void;
  /** Call when the builder closes: drops rows the user never filled in. */
  pruneWodLines: (date: DayKey) => void;
  removeWod: (date: DayKey) => void;

  /* movements */
  addMovement: (name: string, category: MovementCategory, aliases?: string[]) => Movement;
  renameMovement: (id: string, name: string) => void;
  deleteMovement: (id: string) => void;

  /* benchmarks */
  addBenchmark: (name: string, group: BenchmarkGroup, metric: BenchmarkMetric) => BenchmarkDefinition;
  deleteBenchmark: (id: string) => void;
  logResult: (definitionId: string, date: DayKey, value: number, notes?: string) => BenchmarkResult;
  updateResult: (id: string, patch: Partial<BenchmarkResult>) => void;
  deleteResult: (id: string) => void;

  /* measurements */
  setBaseline: (patch: Partial<MeasurementBaseline>) => void;
  logMeasurement: (date: DayKey, values: Partial<MeasurementEntry>) => MeasurementEntry;
  updateMeasurement: (id: string, patch: Partial<MeasurementEntry>) => void;
  deleteMeasurement: (id: string) => void;
  setUnits: (units: UnitSystem) => void;
  setBodyForm: (form: BodyForm) => void;

  /* habits */
  adoptTemplate: (template: HabitTemplate) => Habit;
  addHabit: (title: string, group: HabitGroup) => Habit;
  renameHabit: (id: string, title: string) => void;
  archiveHabit: (id: string) => void;
  toggleHabitCheck: (date: DayKey, habitId: string) => void;
};

/** Unanswered -> yes -> no -> unanswered. */
function nextDone(current: boolean | null): boolean | null {
  if (current === null) return true;
  return current ? false : null;
}

export function createJourneyActions(dispatch: JourneyDispatch): JourneyActions {
  return {
    setEntryText(date, field, value) {
      dispatch({ type: 'entry/setText', date, field, value });
    },

    setIntentionText(date, slot, text) {
      dispatch({ type: 'entry/setIntention', date, slot, patch: { text } });
    },

    cycleIntentionDone(date, slot, current) {
      dispatch({ type: 'entry/setIntention', date, slot, patch: { done: nextDone(current) } });
    },

    setIntentionDone(date, slot, done) {
      dispatch({ type: 'entry/setIntention', date, slot, patch: { done } });
    },

    togglePlusOne(date, key) {
      dispatch({ type: 'entry/togglePlusOne', date, key });
    },

    clearEntry(date) {
      dispatch({ type: 'entry/clear', date });
    },

    toggleWodTag(date, tag) {
      dispatch({ type: 'wod/toggleTag', date, tag });
    },

    setWodRounds(date, rounds) {
      dispatch({ type: 'wod/setRounds', date, rounds });
    },

    setWodText(date, field, value) {
      dispatch({ type: 'wod/setText', date, field, value });
    },

    addWodLine(date) {
      // The id is minted here so the row has a stable React key from its very
      // first render, before anything is typed into it.
      dispatch({ type: 'wod/addLine', date, line: createWodLine() });
    },

    updateWodLine(date, id, patch) {
      dispatch({ type: 'wod/updateLine', date, id, patch });
    },

    removeWodLine(date, id) {
      dispatch({ type: 'wod/removeLine', date, id });
    },

    pruneWodLines(date) {
      dispatch({ type: 'wod/prune', date });
    },

    removeWod(date) {
      dispatch({ type: 'entry/setWod', date, wod: null });
    },

    addMovement(name, category, aliases = []) {
      const movement = createMovement(name.trim(), category, aliases);
      dispatch({ type: 'movement/add', movement });
      return movement;
    },

    renameMovement(id, name) {
      dispatch({ type: 'movement/update', id, patch: { name: name.trim() } });
    },

    deleteMovement(id) {
      dispatch({ type: 'movement/delete', id });
    },

    addBenchmark(name, group, metric) {
      const definition: BenchmarkDefinition = {
        id: makeId(),
        name: name.trim(),
        group,
        metric,
        isCustom: true,
      };
      dispatch({ type: 'benchmark/add', definition });
      return definition;
    },

    deleteBenchmark(id) {
      dispatch({ type: 'benchmark/delete', id });
    },

    logResult(definitionId, date, value, notes = '') {
      const result: BenchmarkResult = { id: makeId(), definitionId, date, value, notes };
      dispatch({ type: 'benchmark/addResult', result });
      return result;
    },

    updateResult(id, patch) {
      dispatch({ type: 'benchmark/updateResult', id, patch });
    },

    deleteResult(id) {
      dispatch({ type: 'benchmark/deleteResult', id });
    },

    setBaseline(patch) {
      dispatch({ type: 'measurement/setBaseline', patch });
    },

    logMeasurement(date, values) {
      // Built from the canonical blank row, so a field the form did not touch
      // is stored as null rather than absent.
      const entry: MeasurementEntry = { ...createMeasurement(date), ...values, date };
      dispatch({ type: 'measurement/add', entry });
      return entry;
    },

    updateMeasurement(id, patch) {
      dispatch({ type: 'measurement/update', id, patch });
    },

    deleteMeasurement(id) {
      dispatch({ type: 'measurement/delete', id });
    },

    setBodyForm(form) {
      dispatch({ type: 'measurement/setBodyForm', form });
    },
    setUnits(units) {
      dispatch({ type: 'measurement/setUnits', units });
    },

    adoptTemplate(template) {
      const habit = createHabit(template.title, template.group, template.id);
      dispatch({ type: 'habit/add', habit });
      return habit;
    },

    addHabit(title, group) {
      const habit = createHabit(title.trim(), group);
      dispatch({ type: 'habit/add', habit });
      return habit;
    },

    renameHabit(id, title) {
      dispatch({ type: 'habit/update', id, patch: { title: title.trim() } });
    },

    archiveHabit(id) {
      dispatch({ type: 'habit/archive', id });
    },

    toggleHabitCheck(date, habitId) {
      dispatch({ type: 'habit/toggleCheck', date, habitId });
    },
  };
}
