import type { IconName } from '../state/types';

export type RouteKey =
  | 'home'
  | 'journey'
  | 'victories'
  | 'goals'
  | 'timer'
  | 'progress'
  | 'plan'
  | 'settings'
  | 'privacy'
  | 'teams';

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
    label: 'Today',
    title: 'Today',
    subtitle: 'Your daily goals',
    icon: 'today-outline',
    iconActive: 'today',
  },
  journey: {
    key: 'journey',
    label: 'Journey',
    title: 'Success Journey',
    subtitle: 'Today’s page',
    icon: 'book-outline',
    iconActive: 'book',
  },
  victories: {
    key: 'victories',
    label: 'Victories',
    title: '3 Victories',
    subtitle: 'Body, mind and spirit',
    icon: 'shield-outline',
    iconActive: 'shield',
  },
  goals: {
    key: 'goals',
    label: 'Goals',
    title: 'Daily goals',
    subtitle: 'Targets and reminders',
    icon: 'flag-outline',
    iconActive: 'flag',
  },
  timer: {
    key: 'timer',
    label: 'Timer',
    title: 'Run timer',
    subtitle: 'Stopwatch and intervals',
    icon: 'stopwatch-outline',
    iconActive: 'stopwatch',
  },
  progress: {
    key: 'progress',
    label: 'Progress',
    title: 'Progress',
    subtitle: 'Streaks and history',
    icon: 'stats-chart-outline',
    iconActive: 'stats-chart',
  },
  plan: {
    key: 'plan',
    label: 'Plan',
    title: 'Training plan',
    subtitle: 'Projected path to your goal',
    icon: 'sparkles-outline',
    iconActive: 'sparkles',
  },
  privacy: {
    key: 'privacy',
    label: 'Privacy',
    title: 'Privacy',
    subtitle: 'What this app knows about you',
    icon: 'lock-closed-outline',
    iconActive: 'lock-closed',
  },
  teams: {
    key: 'teams',
    label: 'Teams',
    title: 'Teams',
    subtitle: 'Squads you coach or train with',
    icon: 'people-outline',
    iconActive: 'people',
  },
  settings: {
    key: 'settings',
    label: 'Settings',
    title: 'Settings',
    subtitle: 'Account and notifications',
    icon: 'settings-outline',
    iconActive: 'settings',
  },
};

/** Routes shown in the bottom bar; the rest live in the slide-out menu. */
export const TAB_ROUTES: RouteKey[] = [
  'home',
  'journey',
  'victories',
  'goals',
  'timer',
  'progress',
];
const BASE_MENU_ROUTES: RouteKey[] = [
  'home',
  'journey',
  'victories',
  'goals',
  'timer',
  'progress',
  'plan',
  'settings',
  'privacy',
];

/**
 * The menu, given what this account can do.
 *
 * Teams appears for anyone in a squad — coach or athlete — and for nobody
 * else, so a solo user's app is exactly the app they had before. It sits in
 * the slide-out rather than the tab bar because six tabs is already the most
 * that fits, and a coach manages a squad occasionally rather than living in it.
 *
 * Derived here, in one place, from one boolean. No component decides for
 * itself whether to show a team affordance.
 */
export function menuRoutes({ hasTeams }: { hasTeams: boolean }): RouteKey[] {
  if (!hasTeams) return BASE_MENU_ROUTES;
  const next = [...BASE_MENU_ROUTES];
  // Directly under Plan, with the training features, not beside Settings.
  next.splice(next.indexOf('plan') + 1, 0, 'teams');
  return next;
}
