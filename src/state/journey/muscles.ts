/**
 * Muscle groups, and how an exercise relates to them.
 *
 * Fifteen regions, chosen to be the coarsest set a body map can show and a
 * person can still recognise. Splitting further — three heads of the deltoid,
 * four of the quadriceps — would be more correct and less useful: nobody
 * scanning a movement list needs to know which head of the triceps a dip
 * favours, and a figure with forty regions is a diagram rather than a glance.
 *
 * Every one of these is the primary mover of at least one seeded movement.
 * A region that can never light up is dead weight on the figure, which is why
 * there is no neck here even though the workbook mentions warming one up.
 *
 * Primary means the movement is largely about that muscle. Secondary means it
 * works, but is not the point. The distinction matters on screen, where
 * shading everything equally would say nothing.
 */
export type MuscleGroup =
  | 'chest'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'lats'
  | 'traps'
  | 'lowerBack'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'adductors'
  | 'calves';

export const MUSCLE_GROUPS: readonly MuscleGroup[] = [
  'chest', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'obliques',
  'lats', 'traps', 'lowerBack', 'glutes', 'quads', 'hamstrings', 'adductors',
  'calves',
];

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: 'Chest',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  lats: 'Lats',
  traps: 'Traps',
  lowerBack: 'Lower back',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  adductors: 'Inner thigh',
  calves: 'Calves',
};

/** Which side of the body a region is drawn on. Some appear on both. */
export const MUSCLE_VIEW: Record<MuscleGroup, 'front' | 'back' | 'both'> = {
  chest: 'front',
  shoulders: 'both',
  biceps: 'front',
  triceps: 'back',
  forearms: 'both',
  abs: 'front',
  obliques: 'front',
  lats: 'back',
  traps: 'back',
  lowerBack: 'back',
  glutes: 'back',
  quads: 'front',
  hamstrings: 'back',
  adductors: 'front',
  calves: 'back',
};

/** How hard a region is working, which is all the figure needs to know. */
export type MuscleEmphasis = 'primary' | 'secondary' | 'none';

export type MuscleWork = {
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
};

export const NO_MUSCLE_WORK: MuscleWork = { primary: [], secondary: [] };

export function emphasisOf(work: MuscleWork, group: MuscleGroup): MuscleEmphasis {
  if (work.primary.includes(group)) return 'primary';
  if (work.secondary.includes(group)) return 'secondary';
  return 'none';
}

/** True when there is anything at all to draw for this view. */
export function worksView(work: MuscleWork, view: 'front' | 'back'): boolean {
  return [...work.primary, ...work.secondary].some(
    (group) => MUSCLE_VIEW[group] === view || MUSCLE_VIEW[group] === 'both',
  );
}

/**
 * A short sentence naming what a movement works.
 *
 * Primary muscles only, and at most three of them — a list of nine reads as
 * noise, and the figure is the thing carrying the detail.
 */
export function muscleSummary(work: MuscleWork): string {
  if (work.primary.length === 0) return 'Not tagged yet';
  const named = work.primary.slice(0, 3).map((group) => MUSCLE_LABEL[group]);
  const rest = work.primary.length - named.length;
  return rest > 0 ? `${named.join(', ')} +${rest}` : named.join(', ');
}
