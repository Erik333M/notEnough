/**
 * Daily-entry and workout reducer.
 *
 * Split from the library reducer because these two are the only actions that
 * *create* the thing they edit: a day and its workout both spring into
 * existence on first edit rather than being added from a list. That lazy
 * creation is what keeps storage honest — paging through history writes
 * nothing, so "days logged" only ever counts days the user actually touched.
 */

import { createEntry } from './factory';
import type {
  DailyEntry,
  DayKey,
  Intention,
  JourneyState,
  PlusOneKey,
  Wod,
  WodLine,
  WodRounds,
  WodTag,
} from './types';
import {
  addLine,
  ensureWod,
  pruneEmptyLines,
  removeLine,
  setRounds,
  toggleTag,
  updateLine,
} from './wod';

/** Which of the two "I will…" lines an action addresses. */
export type IntentionSlot = 'decision' | 'habit';

/** The plain-text fields of a day, edited the same way. */
export type EntryTextField = 'theme' | 'story' | 'skill';

/** The workout's two free-text fields. */
export type WodTextField = 'structure' | 'result';

export type EntryAction =
  | { type: 'entry/setText'; date: DayKey; field: EntryTextField; value: string }
  | { type: 'entry/setIntention'; date: DayKey; slot: IntentionSlot; patch: Partial<Intention> }
  | { type: 'entry/togglePlusOne'; date: DayKey; key: PlusOneKey }
  | { type: 'entry/setWod'; date: DayKey; wod: Wod | null }
  | { type: 'entry/clear'; date: DayKey }
  /* wod — each one lazily creates the workout it edits */
  | { type: 'wod/toggleTag'; date: DayKey; tag: WodTag }
  | { type: 'wod/setRounds'; date: DayKey; rounds: WodRounds | null }
  | { type: 'wod/setText'; date: DayKey; field: WodTextField; value: string }
  | { type: 'wod/addLine'; date: DayKey; line?: WodLine }
  | { type: 'wod/updateLine'; date: DayKey; id: string; patch: Partial<WodLine> }
  | { type: 'wod/removeLine'; date: DayKey; id: string }
  | { type: 'wod/prune'; date: DayKey };

/**
 * Applies `change` to one day, creating the day only if the result differs
 * from a blank one. Reading or touching a day never writes an empty record.
 */
function withEntry(
  state: JourneyState,
  date: DayKey,
  change: (entry: DailyEntry) => DailyEntry,
): JourneyState {
  const existing = state.entries[date];
  const base = existing ?? createEntry(date);
  const next = change(base);
  if (next === base) return state;

  return {
    ...state,
    entries: { ...state.entries, [date]: { ...next, updatedAt: Date.now() } },
  };
}

/**
 * Applies a transform to the day's workout, creating an empty one first if the
 * card has never been opened. `wod: null` is "no workout card yet", so any
 * edit is also the thing that brings the card into existence.
 */
function withWod(state: JourneyState, date: DayKey, change: (wod: Wod) => Wod): JourneyState {
  return withEntry(state, date, (entry) => {
    const current = ensureWod(entry.wod);
    const next = change(current);
    // `next === current` only when the transform was a no-op *and* the workout
    // already existed — creating it is itself a change.
    if (next === current && entry.wod !== null) return entry;
    return { ...entry, wod: next };
  });
}

export function entryReducer(state: JourneyState, action: EntryAction): JourneyState {
  switch (action.type) {
    case 'entry/setText':
      return withEntry(state, action.date, (entry) =>
        entry[action.field] === action.value ? entry : { ...entry, [action.field]: action.value },
      );

    case 'entry/setIntention':
      return withEntry(state, action.date, (entry) => {
        const current = entry[action.slot];
        const next: Intention = { ...current, ...action.patch };
        if (next.text === current.text && next.done === current.done) return entry;
        return { ...entry, [action.slot]: next };
      });

    case 'entry/togglePlusOne':
      return withEntry(state, action.date, (entry) => ({
        ...entry,
        plusOne: { ...entry.plusOne, [action.key]: !entry.plusOne[action.key] },
      }));

    case 'entry/setWod':
      return withEntry(state, action.date, (entry) =>
        entry.wod === action.wod ? entry : { ...entry, wod: action.wod },
      );

    case 'entry/clear': {
      if (!state.entries[action.date]) return state;
      const entries = { ...state.entries };
      delete entries[action.date];
      return { ...state, entries };
    }

    case 'wod/toggleTag':
      return withWod(state, action.date, (wod) => toggleTag(wod, action.tag));

    case 'wod/setRounds':
      return withWod(state, action.date, (wod) => setRounds(wod, action.rounds));

    case 'wod/setText':
      return withWod(state, action.date, (wod) =>
        wod[action.field] === action.value ? wod : { ...wod, [action.field]: action.value },
      );

    case 'wod/addLine':
      return withWod(state, action.date, (wod) => addLine(wod, action.line));

    case 'wod/updateLine':
      return withWod(state, action.date, (wod) => updateLine(wod, action.id, action.patch));

    case 'wod/removeLine':
      return withWod(state, action.date, (wod) => removeLine(wod, action.id));

    case 'wod/prune':
      // Only ever prunes an existing workout — it must not conjure one.
      return state.entries[action.date]?.wod
        ? withWod(state, action.date, pruneEmptyLines)
        : state;

    default:
      return state;
  }
}
