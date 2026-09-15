/**
 * Session, template and handout tests.
 *   node scripts/sessions.test.js
 *
 * Spawns the server against a throwaway database on its own port.
 *
 * The design being checked here is that a "plan" is not a separate thing: a
 * template is a session with no date, copied on use so editing one can never
 * rewrite work an athlete has already been given.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PORT = 4197;
const base = `http://localhost:${PORT}`;
const dbFile = path.join(os.tmpdir(), `notenough-sessions-${Date.now()}.json`);

let failures = 0;

function check(label, condition, detail = '') {
  const mark = condition ? 'PASS' : 'FAIL';
  if (!condition) failures += 1;
  console.log(`  [${mark}] ${label}${detail && !condition ? ` — ${detail}` : ''}`);
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
  console.log('\nSession tests\n');

  const coach = await signUp('Coach');
  const rival = await signUp('Rival');
  const alice = await signUp('Alice');
  const bob = await signUp('Bob');
  const latecomer = await signUp('Late');

  const team = (await call('POST', '/api/teams', { token: coach.token, body: { name: 'Squad' } })).body.team;
  const rivalTeam = (await call('POST', '/api/teams', { token: rival.token, body: { name: 'Rivals' } })).body.team;
  for (const athlete of [alice, bob]) {
    await call('POST', '/api/teams/join', { token: athlete.token, body: { code: team.inviteCode } });
  }

  /* ------------------------------------------------------------ building */

  console.log(' building a session');
  const made = await call('POST', '/api/sessions', {
    token: coach.token,
    body: { teamId: team.id, name: 'Tuesday conditioning', date: '2026-09-22' },
  });
  const session = made.body.session;
  check('coach can create a session', made.status === 201 && session.isTemplate === false);

  const undated = await call('POST', '/api/sessions', {
    token: coach.token,
    body: { teamId: team.id, name: 'No date' },
  });
  check('a session must have a date', undated.status === 400, `got ${undated.status}`);

  const undatedTemplate = await call('POST', '/api/sessions', {
    token: coach.token,
    body: { teamId: team.id, name: 'Warm-up template', isTemplate: true },
  });
  check('a template needs no date', undatedTemplate.status === 201 && undatedTemplate.body.session.date === null);

  const athleteCreates = await call('POST', '/api/sessions', {
    token: alice.token,
    body: { teamId: team.id, name: 'Nope', date: '2026-09-22' },
  });
  check('an athlete cannot create a session', athleteCreates.status === 403, `got ${athleteCreates.status}`);

  const rivalCreates = await call('POST', '/api/sessions', {
    token: rival.token,
    body: { teamId: team.id, name: 'Nope', date: '2026-09-22' },
  });
  check('another team’s coach cannot create in it', rivalCreates.status === 403, `got ${rivalCreates.status}`);

  const rowTask = (await call('POST', `/api/sessions/${session.id}/tasks`, {
    token: coach.token,
    body: { title: '2k row', kind: 'minutes', target: 8 },
  })).body.task;
  await call('POST', `/api/sessions/${session.id}/tasks`, {
    token: coach.token,
    body: { title: '50 burpees', kind: 'reps', target: 50 },
  });
  check('tasks are ordered as added', rowTask.order === 0);

  const athleteAddsTask = await call('POST', `/api/sessions/${session.id}/tasks`, {
    token: alice.token,
    body: { title: 'Nope', kind: 'check', target: 1 },
  });
  check('an athlete cannot add a task', athleteAddsTask.status === 403, `got ${athleteAddsTask.status}`);

  /* ------------------------------------------------------------ handout */

  console.log('\n handing it out');
  const emptySession = (await call('POST', '/api/sessions', {
    token: coach.token,
    body: { teamId: team.id, name: 'Empty', date: '2026-09-23' },
  })).body.session;
  const handOutEmpty = await call('POST', `/api/sessions/${emptySession.id}/handout`, {
    token: coach.token,
    body: { assigneeUserIds: [alice.id] },
  });
  check('a session with no tasks cannot be handed out', handOutEmpty.status === 400, `got ${handOutEmpty.status}`);

  const handOutTemplate = await call('POST', `/api/sessions/${undatedTemplate.body.session.id}/handout`, {
    token: coach.token,
    body: { assigneeUserIds: [alice.id] },
  });
  check('a template cannot be handed out directly', handOutTemplate.status === 400, `got ${handOutTemplate.status}`);

  const handout = await call('POST', `/api/sessions/${session.id}/handout`, {
    token: coach.token,
    body: { assigneeUserIds: [alice.id, bob.id] },
  });
  check('two tasks to two athletes makes four rows', handout.body.added === 4, `got ${handout.body.added}`);
  check('assignments inherit the session date', handout.body.assignments.every((row) => row.dueDate === '2026-09-22'));

  const repeat = await call('POST', `/api/sessions/${session.id}/handout`, {
    token: coach.token,
    body: { assigneeUserIds: [alice.id, bob.id] },
  });
  check('handing out again creates nothing', repeat.body.added === 0, `got ${repeat.body.added}`);

  await call('POST', '/api/teams/join', { token: latecomer.token, body: { code: team.inviteCode } });
  const catchUp = await call('POST', `/api/sessions/${session.id}/handout`, {
    token: coach.token,
    body: { assigneeUserIds: [alice.id, bob.id, latecomer.id] },
  });
  check('a latecomer picks up only their own rows', catchUp.body.added === 2, `got ${catchUp.body.added}`);

  /* ------------------------------------------------------------ progress */

  console.log('\n progress');
  const aliceWork = (await call('GET', '/api/work/mine', { token: alice.token })).body.assignments;
  check('the athlete sees exactly their two tasks', aliceWork.length === 2, `got ${aliceWork.length}`);
  await call('PUT', `/api/work/assignments/${aliceWork[0].id}/result`, {
    token: alice.token,
    body: { amount: 7.5, done: true },
  });

  const coachView = await call('GET', `/api/sessions/${session.id}`, { token: coach.token });
  check('coach sees the whole session', coachView.body.assignments.length === 6, `got ${coachView.body.assignments.length}`);
  check('coach sees the logged result', coachView.body.assignments.some((row) => row.result?.amount === 7.5));
  check('coach is told they are the coach', coachView.body.role === 'coach');

  const aliceView = await call('GET', `/api/sessions/${session.id}`, { token: alice.token });
  check('an athlete sees only their own rows', aliceView.body.assignments.length === 2, `got ${aliceView.body.assignments.length}`);
  check(
    'an athlete cannot see a teammate’s result',
    aliceView.body.assignments.every((row) => row.assigneeUserId === alice.id),
  );

  const rivalView = await call('GET', `/api/sessions/${session.id}`, { token: rival.token });
  check('another team’s coach cannot open the session', rivalView.status === 403, `got ${rivalView.status}`);

  /* ----------------------------------------------------------- templates */

  console.log('\n templates');
  const saved = await call('POST', `/api/sessions/${session.id}/save-as-template`, {
    token: coach.token,
    body: { name: 'Conditioning A' },
  });
  check('a session can be saved as a template', saved.status === 201 && saved.body.session.isTemplate === true);
  check('the template copies its tasks', saved.body.tasks.length === 2);
  check('the template has no date', saved.body.session.date === null);

  const started = await call('POST', `/api/sessions/${saved.body.session.id}/start`, {
    token: coach.token,
    body: { date: '2026-09-29' },
  });
  check('a session can be started from a template', started.status === 201 && started.body.session.date === '2026-09-29');
  check('it inherits the template name', started.body.session.name === 'Conditioning A');
  check('its tasks are copies, not shared rows', started.body.tasks[0].id !== saved.body.tasks[0].id);

  await call('PATCH', `/api/sessions/${saved.body.session.id}/tasks/${saved.body.tasks[0].id}`, {
    token: coach.token,
    body: { title: 'CHANGED', kind: 'reps', target: 1 },
  });
  const afterEdit = await call('GET', `/api/sessions/${started.body.session.id}`, { token: coach.token });
  check(
    'editing the template does not rewrite a started session',
    afterEdit.body.tasks.every((row) => row.title !== 'CHANGED'),
  );

  const startNonTemplate = await call('POST', `/api/sessions/${session.id}/start`, {
    token: coach.token,
    body: { date: '2026-10-01' },
  });
  check('you cannot start from a non-template', startNonTemplate.status === 400, `got ${startNonTemplate.status}`);

  const lists = await call('GET', `/api/sessions/team/${team.id}`, { token: coach.token });
  const templateList = await call('GET', `/api/sessions/team/${team.id}?templates=1`, { token: coach.token });
  check('sessions and templates list separately', !lists.body.sessions.some((row) => row.isTemplate));
  check('the template list holds only templates', templateList.body.sessions.every((row) => row.isTemplate));
  check('list rows carry a task count', lists.body.sessions.find((row) => row.id === session.id)?.taskCount === 2);

  const rivalLists = await call('GET', `/api/sessions/team/${team.id}`, { token: rival.token });
  check('another coach cannot list the team’s sessions', rivalLists.status === 403, `got ${rivalLists.status}`);
  check('rival team is untouched', (await call('GET', `/api/sessions/team/${rivalTeam.id}`, { token: rival.token })).body.sessions.length === 0);

  /* -------------------------------------------------------- deleting work */

  console.log('\n removing a task');
  const before = (await call('GET', '/api/work/mine', { token: alice.token })).body.assignments.length;
  await call('DELETE', `/api/sessions/${session.id}/tasks/${rowTask.id}`, { token: coach.token });
  const after = (await call('GET', '/api/work/mine', { token: alice.token })).body.assignments.length;
  check('deleting a task withdraws its assignments', after === before - 1, `${before} → ${after}`);

  const remaining = await call('GET', `/api/sessions/${session.id}`, { token: coach.token });
  check('remaining tasks are renumbered from zero', remaining.body.tasks[0].order === 0);
  /* --------------------------------------------------- sharing the board */

  console.log('\n sharing a session board');
  const privateByDefault = await call('GET', `/api/sessions/${started.body.session.id}`, {
    token: coach.token,
  });
  check('a new session is private by default', privateByDefault.body.session.shareResults === false);

  const board = (await call('POST', '/api/sessions', {
    token: coach.token,
    body: { teamId: team.id, name: 'Open board', date: '2026-10-05' },
  })).body.session;
  await call('POST', `/api/sessions/${board.id}/tasks`, {
    token: coach.token,
    body: { title: 'Sprints', kind: 'reps', target: 10 },
  });
  await call('POST', `/api/sessions/${board.id}/handout`, {
    token: coach.token,
    body: { assigneeUserIds: [alice.id, bob.id] },
  });
  const bobRow = (await call('GET', '/api/work/mine', { token: bob.token })).body.assignments.find(
    (row) => row.sessionId === board.id,
  );
  await call('PUT', `/api/work/assignments/${bobRow.id}/result`, {
    token: bob.token,
    body: { amount: 10, done: true },
  });

  const closedView = await call('GET', `/api/sessions/${board.id}`, { token: alice.token });
  check('while private, a teammate sees only their own row', closedView.body.assignments.length === 1);

  const athleteOpens = await call('PATCH', `/api/sessions/${board.id}`, {
    token: alice.token,
    body: { shareResults: true },
  });
  check('an athlete cannot open the board', athleteOpens.status === 403, `got ${athleteOpens.status}`);

  await call('PATCH', `/api/sessions/${board.id}`, { token: coach.token, body: { shareResults: true } });
  const openView = await call('GET', `/api/sessions/${board.id}`, { token: alice.token });
  check('once shared, a teammate sees the squad', openView.body.assignments.length === 2, `got ${openView.body.assignments.length}`);
  check("and can see a teammate's result", openView.body.assignments.some((row) => row.result?.amount === 10));

  const rivalOnOpenBoard = await call('GET', `/api/sessions/${board.id}`, { token: rival.token });
  check('sharing does not let an outsider in', rivalOnOpenBoard.status === 403, `got ${rivalOnOpenBoard.status}`);

  const otherSessionStillClosed = await call('GET', `/api/sessions/${session.id}`, { token: alice.token });
  check(
    'sharing one session does not open another',
    otherSessionStillClosed.body.assignments.every((row) => row.assigneeUserId === alice.id),
  );

  await call('PATCH', `/api/sessions/${board.id}`, { token: coach.token, body: { shareResults: false } });
  const reclosed = await call('GET', `/api/sessions/${board.id}`, { token: alice.token });
  check('closing the board takes the view away again', reclosed.body.assignments.length === 1);

} catch (error) {
  failures += 1;
  console.error('\n  [FAIL] test run threw —', error.message);
} finally {
  server.kill();
  await fs.rm(dbFile, { force: true });
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
