import type { TaskKind } from '../../api/teams';

/**
 * How each kind of task is described and counted.
 *
 * The same four kinds the rest of the app already counts in, so a coach and an
 * athlete are never using different words for the same thing.
 */
export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  check: 'Tick',
  reps: 'Reps',
  minutes: 'Minutes',
  distance: 'Metres',
};

/** The long form, for where there is room to explain rather than label. */
export const TASK_KIND_HINT: Record<TaskKind, string> = {
  check: 'They tick it off when it is done.',
  reps: 'They count reps towards a target.',
  minutes: 'They log how long it took.',
  distance: 'They log the distance covered.',
};

export const TASK_KIND_UNIT: Record<TaskKind, string> = {
  check: '',
  reps: 'reps',
  minutes: 'min',
  distance: 'm',
};

export const TASK_KINDS: TaskKind[] = ['check', 'reps', 'minutes', 'distance'];

/** "50 reps", "8 min", or nothing at all for a plain tick-off. */
export function targetLabel(kind: TaskKind, target: number): string {
  if (kind === 'check') return '';
  return `${trim(target)} ${TASK_KIND_UNIT[kind]}`;
}

/** "23.5 / 25 min" — what was done against what was asked. */
export function progressLabel(kind: TaskKind, amount: number, target: number): string {
  if (kind === 'check') return '';
  return `${trim(amount)} / ${trim(target)} ${TASK_KIND_UNIT[kind]}`;
}

/** Whole numbers stay whole; a decimal keeps one place and loses the zero. */
function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}
