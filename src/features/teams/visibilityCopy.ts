import type { IconName } from '../../state/types';

/**
 * What a coach can and cannot see, in plain words.
 *
 * Kept as data, apart from the screen, for the same reason the privacy policy
 * is: this is the wording that matters most in the whole feature, and it
 * should be reviewable without layout around it.
 *
 * Every line here has to be true of the code. If a future change widens what a
 * coach can reach, this file is part of that change.
 */
export type VisibilityLine = { icon: IconName; text: string };

export const CAN_SEE: VisibilityLine[] = [
  { icon: 'clipboard-outline', text: 'The sessions and tasks they set you.' },
  { icon: 'checkmark-circle-outline', text: 'Whether you marked each one done.' },
  { icon: 'stats-chart-outline', text: 'The numbers you logged against them — reps, minutes, distance.' },
  { icon: 'chatbubble-ellipses-outline', text: 'Any note you wrote for them on a task.' },
  { icon: 'person-outline', text: 'Your name, and that you are on the roster.' },
];

export const CANNOT_SEE: VisibilityLine[] = [
  { icon: 'book-outline', text: 'Your Success Journey — every daily page, workout and reflection.' },
  { icon: 'flag-outline', text: 'Your own daily goals and streaks.' },
  { icon: 'repeat-outline', text: 'Your habits and how consistently you keep them.' },
  { icon: 'body-outline', text: 'Your body measurements, weight and heart rate.' },
  { icon: 'medkit-outline', text: 'Your injuries, medical conditions and emergency contact.' },
  { icon: 'mail-outline', text: 'Your email address — rosters carry names only.' },
  { icon: 'people-outline', text: 'Anything from your other teams, even with the same coach.' },
];

export const VISIBILITY_NOTES: { title: string; body: string }[] = [
  {
    title: 'Teammates',
    body: 'By default nobody else on the team sees your results. A coach can open a single session so the squad can compare on that one — you will see it marked as shared when they have.',
  },
  {
    title: 'Why this holds',
    body: 'It is not a setting that could be switched by mistake. Your own training is stored where the server cannot read it, and the code that decides who may see a result is handed the task, never a person — so there is no way to ask for someone’s training at all.',
  },
  {
    title: 'Leaving',
    body: 'Leave the team and their access ends immediately. Everything you logged stays yours and stays in your account.',
  },
];
