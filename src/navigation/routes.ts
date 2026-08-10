import type { IconName } from '../state/types';

export type RouteKey = 'home' | 'goals' | 'timer' | 'progress' | 'plan' | 'settings';

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
export const TAB_ROUTES: RouteKey[] = ['home', 'goals', 'timer', 'progress'];
export const MENU_ROUTES: RouteKey[] = ['home', 'goals', 'timer', 'progress', 'plan', 'settings'];
