/**
 * Authorization tests for teams, assignments and results.
 *   node scripts/teams.test.js
 *
 * Spawns the server against a throwaway database on its own port, so the run
 * is repeatable and never touches development data.
 *
 * The scenario is built around the case that actually matters. Athlete One is
 * on BOTH rosters — Coach A's team and Coach B's team — which is the situation
 * where owner-based access control quietly fails: "a coach may read their
 * athletes" would hand Coach B a result that was recorded for Coach A.
 *
 * Visibility here is scoped by origin instead, so the question is never "is
 * this person one of mine" but "did this work come from my team".
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PORT = 4199;
const base = `http://localhost:${PORT}`;
const dbFile = path.join(os.tmpdir(), `notenough-test-${Date.now()}.json`);

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
    body: { name, email: `${name.toLowerCase().replace(/\W/g, '')}-${Date.now()}@test.local`, password: 'trainhard1' },
  });
  return { token: created.body.token, id: created.body.user.id, name };
}

/**
 * Refuse to run against somebody else's server.
 *
 * A leftover process from an earlier run answers /api/health perfectly well,
 * so the wait below would succeed and every new route would 404 against a
 * build that predates it. That has cost several debugging cycles; a loud
 * failure here is worth more than a silent wrong answer.
 */
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
      const health = await fetch(`${base}/api/health`);
      if (health.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

try {
  if (!(await waitForServer())) throw new Error('Server did not start.');
  console.log('\nTeam authorization tests\n');

  /* ------------------------------------------------------------- setup */

  const coachA = await signUp('CoachA');
  const coachB = await signUp('CoachB');
  const athlete = await signUp('AthleteOne');
  const teammate = await signUp('AthleteTwo');
  const outsider = await signUp('Outsider');

  const teamA = (await call('POST', '/api/teams', { token: coachA.token, body: { name: 'Team A' } })).body;
  const teamB = (await call('POST', '/api/teams', { token: coachB.token, body: { name: 'Team B' } })).body;

  console.log(' setup');
  check('creating a team makes you its coach', teamA.role === 'coach');
  check('invite code is 6 unambiguous characters', /^[A-HJ-NP-Z2-9]{6}$/.test(teamA.team.inviteCode), teamA.team.inviteCode);
  check('two teams get different codes', teamA.team.inviteCode !== teamB.team.inviteCode);

  // The athlete joins BOTH teams. Everything below turns on this.
  await call('POST', '/api/teams/join', { token: athlete.token, body: { code: teamA.team.inviteCode } });
  await call('POST', '/api/teams/join', { token: athlete.token, body: { code: teamB.team.inviteCode } });
  await call('POST', '/api/teams/join', { token: teammate.token, body: { code: teamA.team.inviteCode } });

  const joinedTwice = await call('POST', '/api/teams/join', {
    token: athlete.token,
    body: { code: teamA.team.inviteCode },
  });
  check('re-using a code you already redeemed is a no-op', joinedTwice.status === 200);

  const lowercase = await call('POST', '/api/teams/join', {
    token: outsider.token,
    body: { code: teamA.team.inviteCode.toLowerCase() },
  });
  check('invite codes are case-insensitive', lowercase.status === 200);
  await call('DELETE', `/api/teams/${teamA.team.id}/members/${outsider.id}`, { token: outsider.token });

  /* --------------------------------------------------- solo users untouched */

  console.log('\n solo users');
  const soloTeams = await call('GET', '/api/teams', { token: outsider.token });
  check('a user with no memberships sees no teams', soloTeams.body.teams.length === 0);
  const soloWork = await call('GET', '/api/work/mine', { token: outsider.token });
  check('a solo user has no assigned work', soloWork.body.assignments.length === 0);

  /* ----------------------------------------------------------- assigning */

  console.log('\n assigning');
  const assigned = await call('POST', '/api/work/assignments', {
    token: coachA.token,
    body: {
      teamId: teamA.team.id,
      title: '5k time trial',
      kind: 'minutes',
      target: 25,
      dueDate: '2026-09-20',
      assigneeUserIds: [athlete.id, teammate.id],
    },
  });
  check('coach can assign to the squad', assigned.status === 201 && assigned.body.assignments.length === 2);

  const athleteAssigns = await call('POST', '/api/work/assignments', {
    token: athlete.token,
    body: { teamId: teamA.team.id, title: 'Nope', dueDate: '2026-09-20', assigneeUserIds: [teammate.id] },
  });
  check('an athlete cannot assign work', athleteAssigns.status === 403, `got ${athleteAssigns.status}`);

  const crossAssign = await call('POST', '/api/work/assignments', {
    token: coachB.token,
    body: { teamId: teamA.team.id, title: 'Nope', dueDate: '2026-09-20', assigneeUserIds: [athlete.id] },
  });
  check('a coach cannot assign into another team', crossAssign.status === 403, `got ${crossAssign.status}`);

  const strangerAssign = await call('POST', '/api/work/assignments', {
    token: coachA.token,
    body: { teamId: teamA.team.id, title: 'Nope', dueDate: '2026-09-20', assigneeUserIds: [outsider.id] },
  });
  check('a coach cannot assign to a non-member', strangerAssign.status === 400, `got ${strangerAssign.status}`);

  /* ------------------------------------------------------------- logging */

  console.log('\n logging results');
  const mine = assigned.body.assignments.find((row) => row.assigneeUserId === athlete.id);

  const logged = await call('PUT', `/api/work/assignments/${mine.id}/result`, {
    token: athlete.token,
    body: { amount: 23.5, done: true, notes: 'Felt strong' },
  });
  check('the assignee can log their result', logged.status === 200 && logged.body.result.done === true);

  const coachLogs = await call('PUT', `/api/work/assignments/${mine.id}/result`, {
    token: coachA.token,
    body: { amount: 99, done: true },
  });
  check('a coach cannot log a result for an athlete', coachLogs.status === 403, `got ${coachLogs.status}`);

  const teammateLogs = await call('PUT', `/api/work/assignments/${mine.id}/result`, {
    token: teammate.token,
    body: { amount: 1, done: true },
  });
  check('a teammate cannot log someone else’s result', teammateLogs.status === 403, `got ${teammateLogs.status}`);

  /* ------------------------------------------------- origin-scoped reading */

  console.log('\n who can see the result');
  const coachAView = await call('GET', `/api/work/teams/${teamA.team.id}`, { token: coachA.token });
  const seen = coachAView.body.assignments.find((row) => row.id === mine.id);
  check('the coach who set the work sees the result', seen?.result?.amount === 23.5);
  check('the coach sees the whole squad', coachAView.body.assignments.length === 2);

  const coachBView = await call('GET', `/api/work/teams/${teamB.team.id}`, { token: coachB.token });
  check(
    'the OTHER coach of the same athlete sees nothing of it',
    coachBView.body.assignments.length === 0,
    JSON.stringify(coachBView.body.assignments),
  );

  const coachBReachesIn = await call('GET', `/api/work/teams/${teamA.team.id}`, { token: coachB.token });
  check('a coach cannot read another team’s work', coachBReachesIn.status === 403, `got ${coachBReachesIn.status}`);

  const teammateView = await call('GET', `/api/work/teams/${teamA.team.id}`, { token: teammate.token });
  check(
    'a teammate sees only their own row, not the squad’s',
    teammateView.body.assignments.length === 1 && teammateView.body.assignments[0].assigneeUserId === teammate.id,
  );

  const outsiderView = await call('GET', `/api/work/teams/${teamA.team.id}`, { token: outsider.token });
  check('an outsider cannot read team work', outsiderView.status === 403, `got ${outsiderView.status}`);

  const anonView = await call('GET', `/api/work/teams/${teamA.team.id}`);
  check('an unauthenticated request is rejected', anonView.status === 401, `got ${anonView.status}`);

  /* ------------------------------------------------------------- rosters */

  console.log('\n rosters');
  const roster = await call('GET', `/api/teams/${teamA.team.id}`, { token: coachA.token });
  check('roster lists the coach and both athletes', roster.body.roster.length === 3);
  check(
    'roster never exposes an email address',
    !JSON.stringify(roster.body.roster).includes('@'),
    JSON.stringify(roster.body.roster),
  );

  const outsiderRoster = await call('GET', `/api/teams/${teamA.team.id}`, { token: outsider.token });
  check('an outsider cannot read a roster', outsiderRoster.status === 403, `got ${outsiderRoster.status}`);

  const missingTeam = await call('GET', '/api/teams/does-not-exist', { token: coachA.token });
  check('a missing team is indistinguishable from a forbidden one', missingTeam.status === 403);

  const outsiderRenames = await call('PATCH', `/api/teams/${teamA.team.id}`, {
    token: outsider.token,
    body: { name: 'Hijacked' },
  });
  check('an outsider cannot rename a team', outsiderRenames.status === 403, `got ${outsiderRenames.status}`);

  const athleteRenames = await call('PATCH', `/api/teams/${teamA.team.id}`, {
    token: athlete.token,
    body: { name: 'Hijacked' },
  });
  check('an athlete cannot rename their team', athleteRenames.status === 403, `got ${athleteRenames.status}`);

  const lastCoachLeaves = await call('DELETE', `/api/teams/${teamA.team.id}/members/${coachA.id}`, {
    token: coachA.token,
  });
  check('the last coach cannot leave', lastCoachLeaves.status === 400, `got ${lastCoachLeaves.status}`);

  /* -------------------------------------------------- leaving keeps my data */

  console.log('\n leaving a team');
  await call('DELETE', `/api/teams/${teamA.team.id}/members/${teammate.id}`, { token: coachA.token });
  const afterRemoval = await call('GET', `/api/work/teams/${teamA.team.id}`, { token: teammate.token });
  check('a removed athlete loses access to the team', afterRemoval.status === 403, `got ${afterRemoval.status}`);
  const theirWork = await call('GET', '/api/work/mine', { token: teammate.token });
  check('but keeps their own assignment history', theirWork.body.assignments.length === 1);

  /* -------------------------------------------------------- private data */

  console.log('\n private data stays private');
  const athleteState = await call('PUT', '/api/state', {
    token: athlete.token,
    body: { version: 1, goals: [{ id: 'g1', secret: 'my private goal' }], log: {}, runs: [], plan: {}, updatedAt: Date.now() },
  });
  check('an athlete can save their private state', athleteState.status === 200);

  const coachReadsState = await call('GET', '/api/state', { token: coachA.token });
  check(
    'the coach’s own state fetch returns only their own',
    coachReadsState.body.state === null,
    JSON.stringify(coachReadsState.body.state)?.slice(0, 120),
  );
  check(
    'no team response ever carries private state',
    !JSON.stringify(coachAView.body).includes('my private goal'),
  );
} catch (error) {
  failures += 1;
  console.error('\n  [FAIL] test run threw —', error.message);
} finally {
  server.kill();
  await fs.rm(dbFile, { force: true });
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
