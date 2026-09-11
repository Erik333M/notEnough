/**
 * Pure transforms for a workout.
 *
 * Kept out of the reducer so each one is a plain value-in/value-out function:
 * the reducer decides *which* day changes, these decide *what* the workout
 * becomes. Every one returns the original object unchanged when the edit is a
 * no-op, which is what lets the reducer skip the `updatedAt` stamp and avoid
 * a pointless disk write and sync push.
 */

import { createWodLine, emptyWod } from './factory';
import type { Wod, WodLine, WodRounds, WodTag } from './types';

export function toggleTag(wod: Wod, tag: WodTag): Wod {
  const tags = wod.tags.includes(tag)
    ? wod.tags.filter((t) => t !== tag)
    : [...wod.tags, tag];
  return { ...wod, tags };
}

/** Tapping the selected round clears it — the boxes are a toggle, not a lock. */
export function setRounds(wod: Wod, rounds: WodRounds | null): Wod {
  const next = wod.rounds === rounds ? null : rounds;
  if (next === wod.rounds) return wod;
  return { ...wod, rounds: next };
}

export function addLine(wod: Wod, line: WodLine = createWodLine()): Wod {
  return { ...wod, lines: [...wod.lines, line] };
}

export function updateLine(wod: Wod, id: string, patch: Partial<WodLine>): Wod {
  const index = wod.lines.findIndex((l) => l.id === id);
  if (index === -1) return wod;

  const lines = wod.lines.slice();
  lines[index] = { ...lines[index], ...patch, id };
  return { ...wod, lines };
}

export function removeLine(wod: Wod, id: string): Wod {
  const lines = wod.lines.filter((l) => l.id !== id);
  return lines.length === wod.lines.length ? wod : { ...wod, lines };
}

/**
 * Drops lines the user started but never filled in.
 *
 * Called when the builder closes, so an accidental "add line" tap does not
 * persist as a blank row forever. A line with any content at all is kept.
 */
export function pruneEmptyLines(wod: Wod): Wod {
  const lines = wod.lines.filter(
    (line) =>
      line.reps !== null ||
      line.movementId !== null ||
      line.freeText.trim().length > 0 ||
      line.weightKg !== null ||
      line.notes.trim().length > 0,
  );
  return lines.length === wod.lines.length ? wod : { ...wod, lines };
}

/** An existing workout, or a fresh empty one to start editing. */
export function ensureWod(wod: Wod | null): Wod {
  return wod ?? emptyWod();
}
