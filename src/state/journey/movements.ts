/**
 * Movements catalogue.
 *
 * The seed list lives in data/movements.json and is merged with the user's
 * custom movements at read time — it is never copied into saved state. That is
 * what makes the seed file replaceable: drop in a new list and every existing
 * install picks it up, instead of each user carrying a frozen copy of whatever
 * shipped the day they installed.
 */

import seed from './data/movements.json';
import { readMovement } from './readers';
import type { JourneyState, Movement, MovementCategory } from './types';

/**
 * Parsed once at module load. The seed file is trusted enough to be typed
 * loosely and validated the same way user data is — one reader, one set of
 * rules, so a typo in the JSON degrades instead of crashing the library screen.
 */
const SEED_MOVEMENTS: Movement[] = (seed.movements as unknown[])
  .map((row) => {
    const parsed = readMovement(row);
    if (!parsed) return null;
    // `readMovement` marks everything custom; seeds are the exception.
    return { ...parsed, isCustom: false };
  })
  .filter((m): m is Movement => m !== null);

export const MOVEMENT_CATEGORY_LABEL: Record<MovementCategory, string> = {
  strength: 'Strength',
  weightlifting: 'Weightlifting',
  gymnastics: 'Gymnastics',
  monostructural: 'Cardio',
};

/**
 * Seeds plus the user's own, custom first so a personal movement outranks a
 * seeded one of the same name in search.
 */
export function allMovements(state: JourneyState): Movement[] {
  return [...state.movements, ...SEED_MOVEMENTS];
}

export function movementById(state: JourneyState, id: string | null): Movement | null {
  if (!id) return null;
  return allMovements(state).find((m) => m.id === id) ?? null;
}

/** What to show on a WOD line: the catalogue name, else whatever was typed. */
export function movementLabel(
  state: JourneyState,
  movementId: string | null,
  freeText: string,
): string {
  return movementById(state, movementId)?.name ?? freeText;
}

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Search by name or alias.
 *
 * Prefix matches rank above substring matches, so typing "sn" surfaces Snatch
 * before Dumbbell snatch — the shortest path to the thing most people mean.
 */
export function searchMovements(
  movements: Movement[],
  query: string,
  category: MovementCategory | null = null,
): Movement[] {
  const pool = category ? movements.filter((m) => m.category === category) : movements;
  const q = normalise(query);
  if (!q) return pool;

  const prefix: Movement[] = [];
  const contains: Movement[] = [];

  for (const movement of pool) {
    const haystacks = [movement.name, ...movement.aliases].map(normalise);
    if (haystacks.some((h) => h.startsWith(q))) prefix.push(movement);
    else if (haystacks.some((h) => h.includes(q))) contains.push(movement);
  }
  return [...prefix, ...contains];
}

/** True when a name already exists, so the UI can offer it instead of duplicating. */
export function findMovementByName(movements: Movement[], name: string): Movement | null {
  const target = normalise(name);
  return movements.find((m) => normalise(m.name) === target) ?? null;
}

export function movementsByCategory(movements: Movement[]): Array<{
  category: MovementCategory;
  label: string;
  items: Movement[];
}> {
  return (Object.keys(MOVEMENT_CATEGORY_LABEL) as MovementCategory[])
    .map((category) => ({
      category,
      label: MOVEMENT_CATEGORY_LABEL[category],
      items: movements.filter((m) => m.category === category),
    }))
    .filter((group) => group.items.length > 0);
}
