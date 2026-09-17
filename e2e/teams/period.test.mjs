/**
 * Challenge window arithmetic.
 *   node e2e/teams/period.test.mjs
 *
 * Date maths is where this feature would quietly go wrong — month ends,
 * inclusive boundaries, a leap day, a challenge that starts before it ends by
 * one. The module is import-free so it compiles and runs on its own.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ne-period-'));

execFileSync(
  'npx',
  [
    'tsc',
    'src/features/challenges/period.ts',
    '--outDir', out,
    // Pinned: with no imports to infer from, tsc would otherwise root the
    // output at the file's own directory and the path below would not exist.
    '--rootDir', 'src',
    '--module', 'es2022',
    '--target', 'es2022',
    '--moduleResolution', 'bundler',
    '--skipLibCheck',
    '--ignoreConfig',
    '--noCheck',
  ],
  { stdio: 'inherit' },
);

const { daysInRange, dayCount, fullScore, isRunning, elapsedFraction, suggestPeriod } =
  await import(path.join(out, 'features', 'challenges', 'period.js'));

let failures = 0;
function check(label, condition, detail = '') {
  if (!condition) failures += 1;
  console.log(`  [${condition ? 'PASS' : 'FAIL'}] ${label}${!condition && detail ? ` — ${detail}` : ''}`);
}

console.log('\nChallenge windows\n');

/* ----------------------------------------------------------------- ranges */

check('a single day is one day', dayCount('2026-09-16', '2026-09-16') === 1);
check('both ends are included', dayCount('2026-09-01', '2026-09-07') === 7, `${dayCount('2026-09-01', '2026-09-07')}`);
check('September is 30 days', dayCount('2026-09-01', '2026-09-30') === 30);
check('January is 31', dayCount('2026-01-01', '2026-01-31') === 31);
check('a month boundary is crossed cleanly', dayCount('2026-08-30', '2026-09-02') === 4);
check('a year boundary is crossed cleanly', dayCount('2026-12-30', '2027-01-02') === 4);
check('2028 has a leap day', dayCount('2028-02-01', '2028-02-29') === 29);
check('2026 does not', dayCount('2026-02-01', '2026-02-28') === 28);

check('a backwards range is empty', dayCount('2026-09-10', '2026-09-01') === 0);
check('a malformed date is empty', dayCount('not-a-date', '2026-09-01') === 0);
check('an absurd range is capped', dayCount('2020-01-01', '2030-01-01') === 400);

const week = daysInRange('2026-09-14', '2026-09-20');
check('a range lists every day', week.length === 7);
check('in order', week[0] === '2026-09-14' && week[6] === '2026-09-20', week.join(','));
check('every entry is a day key', week.every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)));

/* ----------------------------------------------------------------- scoring */

check('a full day is three victories', fullScore('2026-09-16', '2026-09-16') === 3);
check('a full week is twenty-one', fullScore('2026-09-14', '2026-09-20') === 21);
check('a full September is ninety', fullScore('2026-09-01', '2026-09-30') === 90);

/* ---------------------------------------------------------------- progress */

check('today is inside its own window', isRunning('2026-09-16', '2026-09-16', '2026-09-16'));
check('the last day still counts', isRunning('2026-09-01', '2026-09-30', '2026-09-30'));
check('the day after does not', !isRunning('2026-09-01', '2026-09-30', '2026-10-01'));
check('before the start does not', !isRunning('2026-09-10', '2026-09-30', '2026-09-09'));

check('nothing elapsed before it starts', elapsedFraction('2026-09-10', '2026-09-20', '2026-09-01') === 0);
check('all elapsed after it ends', elapsedFraction('2026-09-10', '2026-09-20', '2026-09-30') === 1);
check(
  'halfway through a ten day window',
  Math.abs(elapsedFraction('2026-09-11', '2026-09-20', '2026-09-15') - 0.5) < 0.001,
  `${elapsedFraction('2026-09-11', '2026-09-20', '2026-09-15')}`,
);
check('the first day is not zero elapsed', elapsedFraction('2026-09-01', '2026-09-10', '2026-09-01') > 0);

/* -------------------------------------------------------------- suggestions */

const daily = suggestPeriod('daily', '2026-09-16');
check('a daily challenge is one day', daily.from === '2026-09-16' && daily.to === '2026-09-16');

const weekly = suggestPeriod('weekly', '2026-09-16');
check('a weekly challenge runs seven days from today', dayCount(weekly.from, weekly.to) === 7, `${weekly.from}..${weekly.to}`);
check('not to the end of the calendar week', weekly.to === '2026-09-22', weekly.to);

const monthly = suggestPeriod('monthly', '2026-09-16');
check('a monthly challenge is the calendar month', monthly.from === '2026-09-01' && monthly.to === '2026-09-30', `${monthly.from}..${monthly.to}`);

const february = suggestPeriod('monthly', '2028-02-10');
check('and knows about February in a leap year', february.to === '2028-02-29', february.to);

const december = suggestPeriod('monthly', '2026-12-05');
check('and does not spill into next year', december.to === '2026-12-31', december.to);

fs.rmSync(out, { recursive: true, force: true });

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
