import type { IconName } from '../state/types';

/**
 * Five destinations, and nothing else at this level.
 *
 * The shell used to carry ten routes and a slide-out menu to reach the six
 * that would not fit. That is a map of the codebase rather than of anyone's
 * day: Timer, Plan and Progress are things you visit occasionally, and they
 * were competing for space with the screen you open every morning.
 *
 * So each tab owns its own depth now. Victories and Goals open from Home,
 * Timer and Plan from Train, and everything about you — progress, achievements,
 * friends, settings, privacy — lives under Profile. The side menu is gone
 * with them: a second navigation system existed only to hold the overflow.
 */
export type RouteKey = 'home' | 'journey' | 'train' | 'teams' | 'profile';

export type RouteMeta = {
  key: RouteKey;
  label: string;
  title: string;
  subtitle: string;
  icon: IconName;
  iconActive: IconName;
};

export const ROUTES: Record<RouteKey, RouteMeta> = {
  home: {
    key: 'home',
    label: 'Home',
    title: 'Home',
    subtitle: 'Your day, and your people',
    icon: 'home-outline',
    iconActive: 'home',
  },
  journey: {
    key: 'journey',
    label: 'Journey',
    title: 'Success Journey',
    subtitle: 'Today’s page',
    icon: 'book-outline',
    iconActive: 'book',
  },
  train: {
    key: 'train',
    label: 'Train',
    title: 'Train',
    subtitle: 'Timer and training plan',
    icon: 'stopwatch-outline',
    iconActive: 'stopwatch',
  },
  teams: {
    key: 'teams',
    label: 'Teams',
    title: 'Teams',
    subtitle: 'Squads you coach or train with',
    icon: 'people-outline',
    iconActive: 'people',
  },
  profile: {
    key: 'profile',
    label: 'Profile',
    title: 'Profile',
    subtitle: 'You, and what you have done',
    icon: 'person-circle-outline',
    iconActive: 'person-circle',
  },
};

/**
 * Every route is a tab. That is the point of there being five of them — there
 * is no overflow, so there is nowhere for a destination to hide.
 */
export const TAB_ROUTES: RouteKey[] = ['home', 'journey', 'train', 'teams', 'profile'];
