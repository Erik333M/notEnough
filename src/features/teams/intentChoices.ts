import type { IconName } from '../../state/types';
import { accentColor, gradients } from '../../theme/theme';

/**
 * The three answers to the opening question, as data.
 *
 * Kept apart from the screen for the same reason the privacy copy is: the
 * wording is the part most worth reviewing, and it should be readable without
 * layout around it.
 *
 * None of these is an identity. The chosen key picks the opening screen and is
 * never read again — capabilities come from real team memberships, so somebody
 * who answers "on my own" and later joins a squad gets everything, with nothing
 * to undo.
 */
export type Intent = 'solo' | 'athlete' | 'coach';

export type IntentChoice = {
  key: Intent;
  icon: IconName;
  gradient: readonly [string, string];
  tint: string;
  title: string;
  copy: string;
  /** What tapping this actually does, so the tap holds no surprise. */
  next: string;
};

export const INTENT_CHOICES: IntentChoice[] = [
  {
    key: 'solo',
    icon: 'person-outline',
    gradient: gradients.lime,
    tint: accentColor.lime,
    title: 'Train on my own',
    copy: 'Everything you log stays private to you.',
    next: 'Opens on today',
  },
  {
    key: 'athlete',
    icon: 'barbell-outline',
    gradient: gradients.cyan,
    tint: accentColor.cyan,
    title: 'Train with a coach',
    copy: 'They see only the work they set you — never your own training.',
    next: 'Asks for your invite code',
  },
  {
    key: 'coach',
    icon: 'clipboard-outline',
    gradient: gradients.accent,
    tint: accentColor.violet,
    title: 'Coach others',
    copy: 'Build sessions, hand them out, follow how the squad is going.',
    next: 'Starts your first team',
  },
];
