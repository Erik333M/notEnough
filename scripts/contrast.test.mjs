/**
 * Contrast, checked rather than eyeballed.
 *   npm run test:contrast
 *
 * Every pair the design actually puts on screen, measured against WCAG 2.1:
 * 4.5:1 for normal text, 3:1 for large text, controls and meaningful icons.
 *
 * This exists because "looks fine to me" is not a measurement and because a
 * palette drifts — somebody lightens a muted grey by two points to make a
 * caption prettier and quietly takes it below the line for everybody who
 * needed it most.
 *
 * Translucent colours are composited over the background they are drawn on
 * before measuring, because that is what a person's eye receives.
 */

import { THEMES } from '../src/theme/tokens.ts';

let failures = 0;
const check = (label, ratio, floor) => {
  const ok = ratio >= floor;
  if (!ok) failures += 1;
  console.log(
    `  [${ok ? 'PASS' : 'FAIL'}] ${label.padEnd(46)} ${ratio.toFixed(2)}:1 (needs ${floor})`,
  );
};

function parse(colour) {
  if (colour.startsWith('#')) {
    const hex = colour.slice(1);
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
      1,
    ];
  }
  const nums = colour.match(/[\d.]+/g).map(Number);
  return [nums[0], nums[1], nums[2], nums[3] ?? 1];
}

/** Alpha compositing: what the eye actually receives, not what was declared. */
function over(fg, bg) {
  const [fr, fg_, fb, fa] = parse(fg);
  const [br, bg_, bb] = parse(bg);
  if (fa >= 1) return [fr, fg_, fb];
  return [fr * fa + br * (1 - fa), fg_ * fa + bg_ * (1 - fa), fb * fa + bb * (1 - fa)];
}

const channel = (v) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = ([r, g, b]) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

function ratio(fg, bg) {
  const a = luminance(over(fg, bg));
  const b = luminance(over(bg, '#FFFFFF'));
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const LARGE = 3;
const UI = 3;

for (const name of ['dark', 'light']) {
  const t = THEMES[name];
  console.log(`\n ${name}\n`);

  /* Body text, everywhere it sits. */
  for (const [where, bg] of [
    ['background', t.bg],
    ['surface', t.surface],
    ['raised surface', t.surfaceElevated],
  ]) {
    check(`text on ${where}`, ratio(t.text, bg), TEXT);
    check(`muted text on ${where}`, ratio(t.textMuted, bg), TEXT);
  }

  /* The primary action: its label, and the button against the page. */
  check('label on primary button', ratio(t.onPrimary, t.primary), TEXT);
  check('primary button against background', ratio(t.primary, t.bg), UI);
  check('primary as a link on surface', ratio(t.primary, t.surface), TEXT);

  /* State colours, which carry meaning and must not be decorative. */
  for (const role of ['success', 'warning', 'error']) {
    check(`${role} on surface`, ratio(t[role], t.surface), TEXT);
  }

  /* Category accents, on the surfaces they label. */
  for (const role of ['body', 'mind', 'spirit']) {
    check(`${role} accent on surface`, ratio(t.accent[role], t.surface), TEXT);
    check(`${role} accent on its own tint`, ratio(t.accent[role], over(t.accentSoft[role], t.surface).map(Math.round).reduce((s, v, i) => i === 0 ? `rgb(${v}` : i === 2 ? `${s},${v})` : `${s},${v}`, '')), LARGE);
  }

  /* Borders and meaningful glyphs are controls, not text. */
  check('strong border on surface', ratio(t.borderStrong, t.surface), UI);

  /*
   * textFaint is deliberately not checked against 4.5. It is not allowed to
   * carry text anybody has to read — dividers, decorative glyphs and disabled
   * states only. Asserting the floor it *does* have keeps that honest.
   */
  check('faint ink still visible on surface', ratio(t.textFaint, t.surface), UI);
}

console.log(
  failures === 0 ? '\nAll contrast checks passed.\n' : `\n${failures} contrast check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
