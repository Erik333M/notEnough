/**
 * Level thresholds.
 *   node e2e/level.test.mjs
 *
 * A level is published to friends, so the arithmetic behind it is worth
 * pinning: that it never goes backwards, that the boundaries land where they
 * are meant to, and that the top of the ladder does not overflow.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ne-level-'));
execFileSync('npx', [
  'tsc', 'src/features/friends/level.ts',
  '--outDir', out, '--rootDir', 'src',
  '--module', 'es2022', '--target', 'es2022', '--moduleResolution', 'bundler',
  '--skipLibCheck', '--ignoreConfig', '--noCheck',
], { stdio: 'inherit' });

const { levelFor, daysToNextLevel, levelProgress, levelName, LEVEL_STEPS } =
  await import(path.join(out, 'features', 'friends', 'level.js'));

let failures = 0;
const check = (l, ok, d = '') => {
  if (!ok) failures += 1;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${l}${!ok && d ? ` — ${d}` : ''}`);
};

console.log('\nLevels\n');

check('a new account is level 1', levelFor(0) === 1);
check('two days is still level 1', levelFor(2) === 1);
check('three days reaches level 2', levelFor(3) === 2, String(levelFor(3)));
check('the boundary is inclusive', levelFor(7) === 3 && levelFor(6) === 2);
check('a hundred days is level 7', levelFor(100) === 7, String(levelFor(100)));

let previous = 0;
let monotonic = true;
for (let days = 0; days <= 1200; days += 1) {
  const level = levelFor(days);
  if (level < previous) monotonic = false;
  previous = level;
}
check('level never goes backwards', monotonic);
check('it tops out rather than running away', levelFor(100000) === LEVEL_STEPS.length, String(levelFor(100000)));

check('the next level is announced', daysToNextLevel(0) === 3, String(daysToNextLevel(0)));
check('and counts down', daysToNextLevel(2) === 1);
check('and is null at the top', daysToNextLevel(100000) === null);

check('progress starts at zero', levelProgress(0) === 0);
check('progress is halfway between steps', Math.abs(levelProgress(5) - 0.5) < 0.001, String(levelProgress(5)));
check('progress is full at the top', levelProgress(100000) === 1);
check('progress never leaves 0..1', [0, 1, 5, 99, 1000, 99999].every((d) => {
  const p = levelProgress(d);
  return p >= 0 && p <= 1;
}));

check('every level has a name', [1, 2, 4, 6, 9, 12, 15].every((l) => levelName(l).length > 3));
check('the names do not imply rank over anyone', !['belt', 'master', 'elite', 'rank']
  .some((word) => LEVEL_STEPS.map((_, i) => levelName(i + 1).toLowerCase()).join(' ').includes(word)));

fs.rmSync(out, { recursive: true, force: true });
console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
