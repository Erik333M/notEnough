/**
 * Level, worked out from days won.
 *
 * Pure and import-free so the thresholds can be checked without a device.
 *
 * The curve widens deliberately. Early levels come quickly because the point
 * of them is to mark that you have started; later ones take months because a
 * level you can reach in a fortnight says nothing about a year of training.
 * Nothing is unlocked by a level — it is a description, not a gate, and the
 * app withholds no feature behind one.
 */
export const LEVEL_STEPS = [0, 3, 7, 14, 30, 60, 100, 150, 220, 300, 400, 520, 660, 820, 1000];

export function levelFor(daysWon: number): number {
  let level = 1;
  for (const step of LEVEL_STEPS) if (daysWon >= step) level = LEVEL_STEPS.indexOf(step) + 1;
  return level;
}

/** Days still to go, or null once there is no higher level. */
export function daysToNextLevel(daysWon: number): number | null {
  const next = LEVEL_STEPS.find((step) => step > daysWon);
  return next === undefined ? null : next - daysWon;
}

/** How far through the current level, 0..1, for a progress bar. */
export function levelProgress(daysWon: number): number {
  const level = levelFor(daysWon);
  const floor = LEVEL_STEPS[level - 1] ?? 0;
  const ceiling = LEVEL_STEPS[level];
  if (ceiling === undefined) return 1;
  const span = ceiling - floor;
  return span <= 0 ? 1 : Math.min(1, Math.max(0, (daysWon - floor) / span));
}

/**
 * A word for the level, so a number is not the only thing on offer.
 *
 * Kept short and plain. No belts, no ranks, nothing that implies authority
 * over anybody else — this describes how long you have kept at it.
 */
export function levelName(level: number): string {
  if (level <= 1) return 'Starting out';
  if (level <= 3) return 'Finding the habit';
  if (level <= 5) return 'Consistent';
  if (level <= 8) return 'Committed';
  if (level <= 11) return 'Relentless';
  return 'Year-round';
}
