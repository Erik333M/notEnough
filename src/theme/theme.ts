import { Platform } from 'react-native';

/**
 * Single source of truth for the visual language.
 * Dark "liquid glass": deep gradient canvas, translucent frosted surfaces,
 * hairline light borders, one violet/cyan accent pair.
 */

export const palette = {
  // canvas
  bg0: '#05070F',
  bg1: '#0A1024',
  bg2: '#141B3D',
  bg3: '#1C1740',

  // glass surfaces (composited over the canvas gradient)
  glass: 'rgba(255,255,255,0.055)',
  glassStrong: 'rgba(255,255,255,0.10)',
  glassSunken: 'rgba(5,7,15,0.35)',
  hairline: 'rgba(255,255,255,0.11)',
  hairlineStrong: 'rgba(255,255,255,0.20)',

  // ink
  text: '#F3F5FF',
  textMuted: '#A7B0D0',
  textFaint: '#6E779B',
  onAccent: '#08091A',

  // accents
  violet: '#8B6BFF',
  violetSoft: 'rgba(139,107,255,0.18)',
  cyan: '#3FE0E8',
  cyanSoft: 'rgba(63,224,232,0.16)',
  lime: '#B8F27C',
  limeSoft: 'rgba(184,242,124,0.16)',
  amber: '#FFB65C',
  amberSoft: 'rgba(255,182,92,0.16)',
  rose: '#FF7A8F',
  roseSoft: 'rgba(255,122,143,0.16)',
} as const;

export const gradients = {
  canvas: [palette.bg0, palette.bg1, palette.bg3] as const,
  accent: [palette.violet, '#5B7CFF'] as const,
  lime: [palette.lime, '#5FD0A4'] as const,
  amber: [palette.amber, palette.rose] as const,
  cyan: [palette.cyan, palette.violet] as const,
  glassSheen: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.02)'] as const,
};

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

export type AccentName = 'violet' | 'cyan' | 'lime' | 'amber' | 'rose';

export const accentColor: Record<AccentName, string> = {
  violet: palette.violet,
  cyan: palette.cyan,
  lime: palette.lime,
  amber: palette.amber,
  rose: palette.rose,
};

export const accentSoft: Record<AccentName, string> = {
  violet: palette.violetSoft,
  cyan: palette.cyanSoft,
  lime: palette.limeSoft,
  amber: palette.amberSoft,
  rose: palette.roseSoft,
};
