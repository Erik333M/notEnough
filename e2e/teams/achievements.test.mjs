/**
 * Achievement derivation.
 *   node e2e/teams/achievements.test.mjs
 *
 * These are read out of data the app already holds, so the rules — which
 * milestone counts, what stays stable across recomputes — are the whole of the
 * behaviour and belong under test. Compiled on the fly; the module's only
 * imports are types, which the compiler erases.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ne-achievements-'));

execFileSync(
  'npx',
  [
    'tsc',
    'src/features/achievements/derive.ts',
    '--outDir', out,
    '--module', 'es2022',
    '--target', 'es2022',
    '--moduleResolution', 'bundler',
    '--skipLibCheck',
    '--ignoreConfig',
    '--noCheck',
  ],
  { stdio: 'inherit' },
);

const { deriveAchievements } = await import(
  path.join(out, 'features', 'achievements', 'derive.js')
);

let failures = 0;
function check(label, condition, detail = '') {
  if (!condition) failures += 1;
  console.log(`  [${condition ? 'PASS' : 'FAIL'}] ${label}${!condition && detail ? ` — ${detail}` : ''}`);
}

const TODAY = '2026-09-15';
const base = { streak: 0, today: TODAY, personalBests: [], workDone: 0, habitRun: null };

console.log('\nAchievement derivation\n');

/* ------------------------------------------------------------- milestones */

check('a fresh account has nothing to show', deriveAchievements(base).length === 0);
check('two days is not yet a streak', deriveAchievements({ ...base, streak: 2 }).length === 0);

const three = deriveAchievements({ ...base, streak: 3 });
check('three days earns the first streak', three.length === 1 && three[0].value === 3);

const thirty = deriveAchievements({ ...base, streak: 34 });
check('only the highest milestone is shown', thirty.length === 1, `got ${thirty.length}`);
check('and it is the one actually passed', thirty[0].value === 30, `got ${thirty[0]?.value}`);
check('its id is stable', thirty[0].id === 'streak:30', thirty[0]?.id);
check(
  'a longer streak keeps the same id until the next step',
  deriveAchievements({ ...base, streak: 59 })[0].id === 'streak:30',
);
check(
  'passing the next step changes it',
  deriveAchievements({ ...base, streak: 60 })[0].id === 'streak:60',
);

/* --------------------------------------------------------- personal bests */

const pb = {
  definitionId: 'deadlift',
  name: 'Deadlift',
  display: '140 kg',
  value: 140,
  date: '2026-09-14',
};
const withPb = deriveAchievements({ ...base, personalBests: [pb] });
check('a personal best is an achievement', withPb.length === 1);
check('it names the test', withPb[0].title === 'New best: Deadlift', withPb[0]?.title);
check('it shows the value in your own units', withPb[0].detail === '140 kg');
check('it is dated when it happened, not today', withPb[0].achievedAt === '2026-09-14');
check('its id carries the date', withPb[0].id === 'pb:deadlift:2026-09-14', withPb[0]?.id);

const beatenAgain = deriveAchievements({
  ...base,
  personalBests: [{ ...pb, display: '145 kg', value: 145, date: '2026-09-15' }],
});
check(
  'beating it again is a new achievement, not an overwrite',
  beatenAgain[0].id !== withPb[0].id,
);

/* ---------------------------------------------------------------- ordering */

const mixed = deriveAchievements({
  ...base,
  streak: 30,
  personalBests: [{ ...pb, date: '2026-08-01' }],
});
check('two kinds both appear', mixed.length === 2);
check('newest first', mixed[0].kind === 'streak', mixed[0]?.kind);

/* -------------------------------------------------------------- team work */

check('no finished work, no card', deriveAchievements({ ...base, workDone: 0 }).length === 0);
const first = deriveAchievements({ ...base, workDone: 1 });
check('the first finished session counts', first.length === 1);
check('and reads in the singular', first[0].title === 'First session done', first[0]?.title);
check(
  'later ones read in the plural',
  deriveAchievements({ ...base, workDone: 12 })[0].title === '10 sessions done',
);

/* ----------------------------------------------------------------- habits */

check(
  'a six day habit run is not yet a milestone',
  deriveAchievements({ ...base, habitRun: { title: 'Read', days: 6, date: TODAY } }).length === 0,
);
const habit = deriveAchievements({
  ...base,
  habitRun: { title: 'Read', days: 21, date: TODAY },
});
check('two weeks of a habit counts', habit.length === 1 && habit[0].value === 14, `${habit[0]?.value}`);
check('it names the habit', habit[0].title === '14 days: Read', habit[0]?.title);

/* --------------------------------------------------- everything at once */

const all = deriveAchievements({
  streak: 100,
  today: TODAY,
  personalBests: [pb, { ...pb, definitionId: 'row', name: 'Row', date: '2026-09-10' }],
  workDone: 50,
  habitRun: { title: 'Read', days: 30, date: '2026-09-12' },
});
check('all four kinds can coexist', all.length === 5, `got ${all.length}`);
check(
  'ids are unique',
  new Set(all.map((row) => row.id)).size === all.length,
  all.map((row) => row.id).join(', '),
);
check(
  'every one carries a date',
  all.every((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.achievedAt)),
);

fs.rmSync(out, { recursive: true, force: true });

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
