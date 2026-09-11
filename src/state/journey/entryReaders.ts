/**
 * Daily-entry readers.
 *
 * Split from the library readers because a day is the one nested shape in the
 * feature — an entry holds a workout, which holds lines — and it validates
 * differently: a malformed day is repaired into a blank day, while a malformed
 * catalogue row is dropped outright.
 */

import { makeId } from '../../lib/crypto';
import {
  asArray,
  asBool,
  asBoundedNumber,
  asDayKey,
  asNullableBool,
  asNullableNumber,
  asNumber,
  asOptionalEnum,
  asPositiveInt,
  asString,
  isRecord,
} from './coerce';
import { PLUS_ONE_KEYS, createEntry, emptyIntention, emptyPlusOne } from './factory';
import { LINE_MAX, NOTE_MAX } from './limits';
import type { DailyEntry, Intention, PlusOne, Wod, WodLine, WodRounds, WodTag } from './types';
import { WOD_ROUNDS, WOD_TAGS } from './types';

/* ------------------------------------------------------------- daily entry */

function readIntention(value: unknown): Intention {
  if (!isRecord(value)) return emptyIntention();
  return {
    text: asString(value.text, '', LINE_MAX),
    done: asNullableBool(value.done),
  };
}

function readPlusOne(value: unknown): PlusOne {
  const next = emptyPlusOne();
  if (!isRecord(value)) return next;
  for (const key of PLUS_ONE_KEYS) next[key] = asBool(value[key]);
  return next;
}

function readWodLine(value: unknown): WodLine | null {
  if (!isRecord(value)) return null;
  return {
    id: asString(value.id, '', 64) || makeId(),
    reps: asPositiveInt(value.reps),
    movementId: asString(value.movementId, '', 64) || null,
    freeText: asString(value.freeText, '', LINE_MAX),
    // A negative or absurd load is a corrupt read, not a lift.
    weightKg: asBoundedNumber(value.weightKg, 0, 1000),
    notes: asString(value.notes, '', NOTE_MAX),
  };
}

function readWod(value: unknown): Wod | null {
  // Null is meaningful — it is "no workout card yet", not a missing field.
  if (!isRecord(value)) return null;

  const tags: WodTag[] = [];
  if (Array.isArray(value.tags)) {
    for (const tag of value.tags) {
      const parsed = asOptionalEnum<WodTag>(tag, WOD_TAGS);
      if (parsed && !tags.includes(parsed)) tags.push(parsed);
    }
  }

  const rounds = asNullableNumber(value.rounds);
  return {
    tags,
    rounds: WOD_ROUNDS.includes(rounds as WodRounds) ? (rounds as WodRounds) : null,
    lines: asArray(value.lines, readWodLine, 60),
    structure: asString(value.structure, '', LINE_MAX),
    result: asString(value.result, '', LINE_MAX),
  };
}

/**
 * A stored day. The date comes from the record's own key rather than its body,
 * so a mismatched `date` field can never produce an entry filed under the
 * wrong day.
 */
export function readEntry(date: string, value: unknown): DailyEntry {
  const base = createEntry(date, 0);
  if (!isRecord(value)) return base;

  return {
    date,
    theme: asString(value.theme, '', LINE_MAX),
    story: asString(value.story, '', NOTE_MAX),
    wod: readWod(value.wod),
    skill: asString(value.skill, '', NOTE_MAX),
    decision: readIntention(value.decision),
    habit: readIntention(value.habit),
    plusOne: readPlusOne(value.plusOne),
    updatedAt: asNumber(value.updatedAt, 0),
  };
}

export function readEntries(value: unknown): Record<string, DailyEntry> {
  const out: Record<string, DailyEntry> = {};
  if (!isRecord(value)) return out;

  for (const [key, stored] of Object.entries(value)) {
    // A key that is not a day key cannot be addressed by any screen, so it is
    // dropped rather than carried forward forever.
    if (asDayKey(key) === null) continue;
    out[key] = readEntry(key, stored);
  }
  return out;
}
