/**
 * Session reminder planning.
 *   node e2e/teams/reminders.test.mjs
 *
 * The scheduling itself needs a device, so the decisions worth getting right
 * were pulled into a pure module and are checked here: how many reminders a
 * pile of assignments should produce, and which ones should not exist at all.
 *
 * The module is compiled on the fly. Its only import is a type, which the
 * compiler erases, so nothing native is involved.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ne-reminders-'));

execFileSync(
  'npx',
  [
    'tsc',
    'src/notifications/reminderPlan.ts',
    '--outDir',
    out,
    '--module',
    'es2022',
    '--target',
    'es2022',
    '--moduleResolution',
    'bundler',
    '--skipLibCheck',
    // The project tsconfig is not loaded when files are named on the command
    // line, and TypeScript treats that as an error unless told it is intended.
    '--ignoreConfig',
    // Emit only. Type-checking here would follow the erased `Assignment`
    // import into the app's API client and fail on DOM/node globals that have
    // nothing to do with this module — `npm run typecheck` covers that ground
    // properly, with the real config.
    '--noCheck',
  ],
  { stdio: 'inherit' },
);

const { planReminders, reminderBody, reminderDate } = await import(
  path.join(out, 'notifications', 'reminderPlan.js')
);

let failures = 0;
function check(label, condition, detail = '') {
  if (!condition) failures += 1;
  console.log(`  [${condition ? 'PASS' : 'FAIL'}] ${label}${!condition && detail ? ` — ${detail}` : ''}`);
}

const TODAY = '2026-09-15';
const make = (over = {}) => ({
  id: `a${Math.random()}`,
  sessionId: 's1',
  dueDate: TODAY,
  result: null,
  ...over,
});

console.log('\nSession reminder planning\n');

/* ------------------------------------------------------------- grouping */

const fourTasks = [make(), make(), make(), make()];
const plans = planReminders(fourTasks, TODAY);
check('four tasks in one session make one reminder', plans.length === 1, `got ${plans.length}`);
check('the reminder knows how many tasks', plans[0].count === 4, `got ${plans[0]?.count}`);
check('one task reads in the singular', reminderBody({ count: 1 }).includes('One task'));
check('several read in the plural', reminderBody({ count: 4 }).includes('4 tasks'));

const twoSessions = planReminders(
  [make({ sessionId: 's1' }), make({ sessionId: 's2' })],
  TODAY,
);
check('two sessions on one day make two reminders', twoSessions.length === 2);

const twoDays = planReminders(
  [make({ dueDate: '2026-09-20' }), make({ dueDate: '2026-09-18' })],
  TODAY,
);
check('two dates make two reminders', twoDays.length === 2);
check('they come back in date order', twoDays[0].date === '2026-09-18', twoDays[0]?.date);

/* -------------------------------------------------------- what to skip */

check(
  'finished work needs no reminder',
  planReminders([make({ result: { done: true } })], TODAY).length === 0,
);
check(
  'yesterday needs no reminder',
  planReminders([make({ dueDate: '2026-09-14' })], TODAY).length === 0,
);
check(
  'a half-finished session still reminds, once',
  planReminders([make({ result: { done: true } }), make()], TODAY).length === 1,
);
check('nothing assigned means nothing scheduled', planReminders([], TODAY).length === 0);

const standalone = planReminders([make({ sessionId: null, id: 'solo-1' })], TODAY);
check('work with no session still gets a reminder', standalone.length === 1);
check('and is keyed by its own id', standalone[0].sessionId === 'solo-1', standalone[0]?.sessionId);

// Batched on purpose, and worth stating: two loose tasks on the same day are
// still one thing to be told about. The rule is one buzz per day's worth of
// work from a source, not one per task.
const mixed = planReminders(
  [make({ sessionId: null, id: 'x' }), make({ sessionId: null, id: 'y' })],
  TODAY,
);
check('two standalone tasks on one day batch into one buzz', mixed.length === 1, `got ${mixed.length}`);
check('and it counts both', mixed[0].count === 2, `got ${mixed[0]?.count}`);

/* ------------------------------------------------------------- the time */

const morning = new Date(2026, 8, 20, 8, 0, 0, 0).getTime();
const dayBefore = new Date(2026, 8, 19, 12, 0, 0, 0).getTime();
check('a future date fires at 08:00 local', reminderDate('2026-09-20', dayBefore)?.getHours() === 8);
check(
  'a time already past today is not scheduled',
  reminderDate('2026-09-20', morning + 1000) === null,
);
check('a malformed date is refused', reminderDate('not-a-date', dayBefore) === null);

fs.rmSync(out, { recursive: true, force: true });

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
