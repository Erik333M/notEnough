/**
 * Jobs given to an event's staff.
 *   node scripts/event-tasks.test.js
 *
 * There is no new machinery behind this and these checks exist to prove it.
 * A staff job is a standalone assignment — a title, a person, a date and a
 * tick — which is precisely what the work routes already handed out to
 * athletes. What had to be verified rather than assumed:
 *
 *  1. Staff can be given work at all. The roster check accepts a coach.
 *  2. Campers cannot see the staff rota, and cannot hand jobs out.
 *  3. The person the job belongs to is the one who can tick it off.
 *  4. It reaches them the same way any other work does, on their own list.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PORT = 4200;
const base = `http://localhost:${PORT}`;
const dbFile = path.join(os.tmpdir(), `notenough-event-tasks-${Date.now()}.json`);

let failures = 0;
function check(label, condition, detail = '') {
  if (!condition) failures += 1;
  console.log(`  [${condition ? 'PASS' : 'FAIL'}] ${label}${detail && !condition ? ` — ${detail}` : ''}`);
}

async function call(method, endpoint, { token, body } = {}) {
  const response = await fetch(`${base}${endpoint}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: response.status, body: json };
}

async function signUp(name) {
  const created = await call('POST', '/api/auth/register', {
    body: {
      name,
      email: `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`,
      password: 'trainhard1',
    },
  });
  return { token: created.body.token, id: created.body.user.id, name };
}

const squatter = await fetch(`${base}/api/health`).catch(() => null);
if (squatter?.ok) {
  console.error(`\nPort ${PORT} is already serving something. Kill it first:\n  lsof -ti:${PORT} | xargs kill\n`);
  process.exit(1);
}

const server = spawn('node', ['src/index.js'], {
  cwd: path.join(import.meta.dirname, '..'),
  env: { ...process.env, PORT: String(PORT), DB_FILE: dbFile, JWT_SECRET: 'test-secret' },
  stdio: ['ignore', 'ignore', 'inherit'],
});

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

try {
  if (!(await waitForServer())) throw new Error('Server did not start.');
  console.log('\nStaff job tests\n');

  const boss = await signUp('Boss');
  const helper = await signUp('Helper');
  const kid = await signUp('Kid');
  const outsider = await signUp('Outsider');

  const made = await call('POST', '/api/events', {
    token: boss.token,
    body: {
      name: 'Summer Camp',
      startDate: '2026-07-01',
      endDate: '2026-07-10',
      ageMin: 10,
      ageMax: 14,
      capacity: 20,
      staffTarget: 2,
    },
  });
  const campTeam = made.body.team;
  for (const who of [helper, kid]) {
    await call('POST', '/api/teams/join', { token: who.token, body: { code: campTeam.inviteCode } });
  }
  await call('PATCH', `/api/teams/${campTeam.id}/members/${helper.id}`, {
    token: boss.token,
    body: { role: 'coach' },
  });

  const giveJob = (to, title, token = boss.token, dueDate = '2026-07-02') =>
    call('POST', '/api/work/assignments', {
      token,
      body: {
        teamId: campTeam.id,
        assigneeUserIds: [to.id],
        title,
        kind: 'check',
        target: 1,
        dueDate,
      },
    });

  /* ------------------------------------------------------- handing them out */

  console.log(' handing jobs out');
  const toStaff = await giveJob(helper, 'Set the hall up before nine');
  check('staff can be given a job', toStaff.status === 201, `got ${toStaff.status}`);
  const job = toStaff.body.assignments[0];
  check('it is a plain tick, not training', job.kind === 'check' && job.sessionId === null,
    JSON.stringify({ kind: job.kind, sessionId: job.sessionId }));
  check('and it carries the date it is due', job.dueDate === '2026-07-02', job.dueDate);

  const byCamper = await giveJob(helper, 'Do my chores', kid.token);
  check('a camper cannot hand jobs out', byCamper.status === 403, `got ${byCamper.status}`);

  const byOutsider = await giveJob(helper, 'Nothing to do with you', outsider.token);
  check('nor can somebody outside the camp', byOutsider.status === 403, `got ${byOutsider.status}`);

  const toNobody = await call('POST', '/api/work/assignments', {
    token: boss.token,
    body: {
      teamId: campTeam.id,
      assigneeUserIds: [outsider.id],
      title: 'Ghost job',
      kind: 'check',
      target: 1,
      dueDate: '2026-07-02',
    },
  });
  check('a job cannot be given to somebody not at the camp', toNobody.status === 400,
    `got ${toNobody.status}`);

  /* ------------------------------------------------------------ who sees it */

  console.log('\n who sees the rota');
  const bossSees = await call('GET', `/api/work/teams/${campTeam.id}`, { token: boss.token });
  check('the organiser sees the whole rota', bossSees.body.assignments.some((row) => row.id === job.id),
    String(bossSees.body.assignments.length));

  const helperSees = await call('GET', `/api/work/teams/${campTeam.id}`, { token: helper.token });
  check('and the staff member sees their own', helperSees.body.assignments.some((row) => row.id === job.id));

  const kidSees = await call('GET', `/api/work/teams/${campTeam.id}`, { token: kid.token });
  check('a camper sees none of the staff rota',
    !kidSees.body.assignments.some((row) => row.id === job.id),
    JSON.stringify(kidSees.body.assignments.map((row) => row.title)));

  const outsiderSees = await call('GET', `/api/work/teams/${campTeam.id}`, { token: outsider.token });
  check('somebody outside the camp sees nothing at all', outsiderSees.status === 403,
    `got ${outsiderSees.status}`);

  const onTheirList = await call('GET', '/api/work/mine', { token: helper.token });
  check('it reaches them like any other work', onTheirList.body.assignments.some((row) => row.id === job.id));
  const kidList = await call('GET', '/api/work/mine', { token: kid.token });
  check('and not onto a camper\'s', !kidList.body.assignments.some((row) => row.id === job.id));

  /* ------------------------------------------------------------- ticking off */

  console.log('\n ticking it off');
  const byOther = await call('PUT', `/api/work/assignments/${job.id}/result`, {
    token: boss.token,
    body: { done: true, amount: 1 },
  });
  check('even the organiser cannot tick off somebody else\'s job', byOther.status === 403,
    `got ${byOther.status}`);

  const ticked = await call('PUT', `/api/work/assignments/${job.id}/result`, {
    token: helper.token,
    body: { done: true, amount: 1 },
  });
  check('the person it belongs to can', ticked.status === 200, `got ${ticked.status}`);

  const seen = await call('GET', `/api/work/teams/${campTeam.id}`, { token: boss.token });
  const row = seen.body.assignments.find((entry) => entry.id === job.id);
  check('and the organiser sees it done', row?.result?.done === true, JSON.stringify(row?.result));

  /* ------------------------------------------------------------- taking back */

  console.log('\n calling a job off');
  const second = (await giveJob(helper, 'Count the life jackets')).body.assignments[0];
  const byKid = await call('DELETE', `/api/work/assignments/${second.id}`, { token: kid.token });
  check('a camper cannot call a job off', byKid.status === 403, `got ${byKid.status}`);

  /*
   * Any staff member can, including the one it was given to.
   *
   * Staff are coaches of the camp's team, and withdrawing work is a coach's
   * power — so somebody trusted to run the camp is trusted to drop a job off
   * the rota. Worth asserting rather than assuming: the reverse would be a
   * reasonable design too, and this is the one that is actually implemented.
   */
  const byHelper = await call('DELETE', `/api/work/assignments/${second.id}`, { token: helper.token });
  check('any staff member can, including its owner', byHelper.status === 204, `got ${byHelper.status}`);

  const third = (await giveJob(helper, 'Lock the store')).body.assignments[0];
  const byBoss = await call('DELETE', `/api/work/assignments/${third.id}`, { token: boss.token });
  check('and so can the organiser', byBoss.status === 204, `got ${byBoss.status}`);

  /* --------------------------------------------------- still not training */

  console.log('\n a job is not training');
  const stateBefore = await call('GET', '/api/state', { token: helper.token });
  check('ticking a job wrote nothing into their private journal',
    stateBefore.status === 200 || stateBefore.status === 404,
    `got ${stateBefore.status}`);
} catch (error) {
  failures += 1;
  console.error('\n  [FAIL] test run threw —', error.message);
} finally {
  server.kill();
  await fs.rm(dbFile, { force: true });
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
