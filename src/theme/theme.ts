import { Platform } from 'react-native';

/**
 * Everything about the look that is *not* a colour.
 *
 * Radius, spacing, type, shadow and motion are the same in both themes — a
 * corner does not get rounder in the dark — so they stay plain constants and
 * can be read at module scope. Colours changed with the theme, so they moved
 * to tokens.ts and are read through `useTheme`.
 */
export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  pill: 999,
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
} as const;

export const font = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
  mono: {
    fontVariant: ['tabular-nums'] as const,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
} as const;

export const shadow = {
  card: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
    },
    default: { elevation: 6 },
  }),
  float: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.45,
      shadowRadius: 30,
      shadowOffset: { width: 0, height: 18 },
    },
    default: { elevation: 12 },
  }),
} as const;

/** Motion constants — keep every animation on the same curve family. */
export const motion = {
  fast: 160,
  base: 260,
  slow: 420,
  spring: { damping: 18, stiffness: 180, mass: 0.9 },
  springSoft: { damping: 22, stiffness: 120, mass: 1 },
} as const;

/**
 * Re-exported so the hundreds of existing imports keep working. Colour roles
 * live in tokens.ts now; this file is what is left of the old palette once the
 * colours were taken out of it — measurements, type and motion, none of which
 * change with the theme.
 */
export type { AccentName } from './tokens';
