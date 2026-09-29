/**
 * The colour system, as roles rather than names.
 *
 * Every colour in the app comes from here, and nothing reads "violet" or
 * "#B9EF35" at a call site. That is what makes a second theme possible at all:
 * a screen asks for `surface` and gets whichever surface is currently right.
 *
 * ── The identity ────────────────────────────────────────────────────────────
 *
 * Graphite and athletic lime. Dark is the signature — it is what the app looks
 * like in a gym at six in the morning — and light is complete rather than a
 * concession, because plenty of people keep their phone on light all day.
 *
 * Lime is the *action* colour and almost nothing else. A screen where every
 * card glows lime says nothing about what to press; one lime button on a
 * graphite page says everything. The three category accents exist only where
 * body, mind and spirit have to be told apart at a glance.
 */

export type ThemeName = 'dark' | 'light';

/** What a colour is for. Names describe the role, never the hue. */
export type Palette = {
  /* canvas */
  bg: string;
  bgDeep: string;
  bgLift: string;

  /* surfaces */
  surface: string;
  surfaceElevated: string;
  surfaceSunken: string;

  /* lines */
  border: string;
  borderStrong: string;

  /* ink */
  text: string;
  textMuted: string;
  textFaint: string;

  /* the one action colour */
  primary: string;
  primarySoft: string;
  onPrimary: string;

  /* states */
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  error: string;
  errorSoft: string;

  /* overlays */
  scrim: string;
  shadow: string;
};

/**
 * Body, mind and spirit.
 *
 * Three victories a day is the spine of this app, and they need telling apart
 * without reading the label. Body borrows the primary lime because the body is
 * what the app is mostly about; the other two get their own hue.
 *
 * `warning` and `danger` sit in the same map because components take an accent
 * by name, and a pill saying "overdue" needs the same mechanism as one saying
 * "mind".
 */
export type AccentName = 'body' | 'mind' | 'spirit' | 'warning' | 'danger' | 'neutral';

export type Accents = Record<AccentName, string>;

const DARK: Palette = {
  bg: '#10151C',
  bgDeep: '#0B0F14',
  bgLift: '#161E28',

  surface: '#1B242E',
  surfaceElevated: '#222D39',
  surfaceSunken: '#0D1218',

  border: 'rgba(234,240,228,0.12)',
  // 3:1 against surface. This is the border that says "selected" or "focused",
  // and WCAG treats that as a control boundary, not decoration — 0.22 looked
  // right and measured 1.93, which is invisible to plenty of people.
  borderStrong: 'rgba(234,240,228,0.45)',

  text: '#EAF0E4',
  textMuted: '#AAB5AA',
  // Never used for anything that has to be read — see notes in the contrast
  // test. Dividing lines, disabled glyphs, and decorative marks only.
  textFaint: '#7C877C',

  primary: '#B9EF35',
  primarySoft: 'rgba(185,239,53,0.16)',
  onPrimary: '#10151C',

  success: '#8FD14F',
  successSoft: 'rgba(143,209,79,0.16)',
  warning: '#F0B429',
  warningSoft: 'rgba(240,180,41,0.16)',
  error: '#FF8A7A',
  errorSoft: 'rgba(255,138,122,0.16)',

  scrim: 'rgba(6,9,12,0.74)',
  shadow: '#000000',
};

const LIGHT: Palette = {
  bg: '#F7F8F4',
  bgDeep: '#EEF0E9',
  bgLift: '#FFFFFF',

  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSunken: '#EDEFE8',

  border: 'rgba(23,32,24,0.12)',
  /** 3:1 against white. See the note on the dark border. */
  borderStrong: 'rgba(23,32,24,0.55)',

  text: '#172018',
  textMuted: '#526052',
  textFaint: '#7A857A',

  primary: '#397400',
  primarySoft: 'rgba(57,116,0,0.12)',
  onPrimary: '#FFFFFF',

  success: '#2E6B12',
  successSoft: 'rgba(46,107,18,0.12)',
  warning: '#8A5A00',
  warningSoft: 'rgba(138,90,0,0.12)',
  error: '#A8301C',
  errorSoft: 'rgba(168,48,28,0.12)',

  scrim: 'rgba(23,32,24,0.42)',
  shadow: '#1B2A1B',
};

const DARK_ACCENTS: Accents = {
  body: DARK.primary,
  mind: '#78B9FF',
  spirit: '#C3A5FF',
  warning: DARK.warning,
  danger: DARK.error,
  neutral: DARK.textMuted,
};

const LIGHT_ACCENTS: Accents = {
  body: LIGHT.primary,
  mind: '#1764A5',
  spirit: '#7045A0',
  warning: LIGHT.warning,
  danger: LIGHT.error,
  neutral: LIGHT.textMuted,
};

/** A tint of an accent, for a chip background behind its own label. */
const softOf = (name: ThemeName): Accents =>
  name === 'dark'
    ? {
        body: DARK.primarySoft,
        mind: 'rgba(120,185,255,0.16)',
        spirit: 'rgba(195,165,255,0.16)',
        warning: DARK.warningSoft,
        danger: DARK.errorSoft,
        neutral: 'rgba(234,240,228,0.08)',
      }
    : {
        body: LIGHT.primarySoft,
        mind: 'rgba(23,100,165,0.12)',
        spirit: 'rgba(112,69,160,0.12)',
        warning: LIGHT.warningSoft,
        danger: LIGHT.errorSoft,
        neutral: 'rgba(23,32,24,0.07)',
      };

export type Theme = Palette & {
  name: ThemeName;
  accent: Accents;
  accentSoft: Accents;
  /** Canvas gradient, deepest first. Subtle by design — it is a page, not art. */
  canvas: readonly [string, string, string];
  /** The one gradient that means "press this". */
  primaryGradient: readonly [string, string];
  /** For things that are running out — a deadline, an overdue job. */
  warmGradient: readonly [string, string];
  /** Mind into spirit, for the non-physical half of the app. */
  coolGradient: readonly [string, string];
  sheen: readonly [string, string];
};

export const THEMES: Record<ThemeName, Theme> = {
  dark: {
    ...DARK,
    name: 'dark',
    accent: DARK_ACCENTS,
    accentSoft: softOf('dark'),
    canvas: [DARK.bgDeep, DARK.bg, DARK.bgLift],
    primaryGradient: [DARK.primary, '#8FD14F'],
    warmGradient: [DARK.warning, DARK.error],
    coolGradient: [DARK_ACCENTS.mind, DARK_ACCENTS.spirit],
    sheen: ['rgba(234,240,228,0.07)', 'rgba(234,240,228,0.01)'],
  },
  light: {
    ...LIGHT,
    name: 'light',
    accent: LIGHT_ACCENTS,
    accentSoft: softOf('light'),
    canvas: [LIGHT.bgDeep, LIGHT.bg, LIGHT.bgLift],
    primaryGradient: [LIGHT.primary, '#2E6B12'],
    warmGradient: [LIGHT.warning, LIGHT.error],
    coolGradient: [LIGHT_ACCENTS.mind, LIGHT_ACCENTS.spirit],
    sheen: ['rgba(23,32,24,0.04)', 'rgba(23,32,24,0.01)'],
  },
};
