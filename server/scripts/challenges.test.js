/**
 * Challenges and their rankings.
 *   node scripts/challenges.test.js
 *
 * A leaderboard is the first thing in this app that ranks people against each
 * other, so the checks are mostly about consent and containment: nobody
 * appears on a board they did not join, a score reveals nothing about the
 * training behind it, and leaving takes you off completely.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PORT = 4194;
const base = `http://localhost:${PORT}`;
const dbFile = path.join(os.tmpdir(), `notenough-challenges-${Date.now()}.json`);

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
      if ((await fetch(`${base}/api/health`)).ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

const monthly = {
  scope: 'monthly',
  title: 'September: three a day',
  description: 'Win all three victories as often as you can.',
  reward: 'Coffee on me',
  target: 30,
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
};

try {
  if (!(await waitForServer())) throw new Error('Server did not start.');
  console.log('\nChallenge tests\n');

  const coach = await signUp('Coach');
  const alice = await signUp('Alice');
  const bob = await signUp('Bob');
  const cara = await signUp('Cara');
  const rival = await signUp('Rival');
  const outsider = await signUp('Outsider');

  const team = (await call('POST', '/api/teams', { token: coach.token, body: { name: 'Squad' } })).body.team;
  const other = (await call('POST', '/api/teams', { token: rival.token, body: { name: 'Others' } })).body.team;
  for (const person of [alice, bob, cara]) {
    await call('POST', '/api/teams/join', { token: person.token, body: { code: team.inviteCode } });
  }
  await call('POST', '/api/teams/join', { token: alice.token, body: { code: other.inviteCode } });

  /* --------------------------------------------------------------- setting */

  console.log(' setting one up');
  const made = await call('POST', `/api/teams/${team.id}/challenges`, { token: coach.token, body: monthly });
  const challenge = made.body.challenge;
  check('a coach can set a challenge', made.status === 201, `got ${made.status}`);
  check('it starts with nobody in it', made.body.entries.length === 0);
  check('the reward is just text the coach wrote', challenge.reward === 'Coffee on me');

  const athleteMakes = await call('POST', `/api/teams/${team.id}/challenges`, {
    token: alice.token,
    body: monthly,
  });
  check('an athlete cannot set one', athleteMakes.status === 403, `got ${athleteMakes.status}`);

  const rivalMakes = await call('POST', `/api/teams/${team.id}/challenges`, {
    token: rival.token,
    body: monthly,
  });
  check('another team’s coach cannot set one here', rivalMakes.status === 403, `got ${rivalMakes.status}`);

  const backwards = await call('POST', `/api/teams/${team.id}/challenges`, {
    token: coach.token,
    body: { ...monthly, periodEnd: '2026-08-01' },
  });
  check('it cannot end before it starts', backwards.status === 400, `got ${backwards.status}`);

  const badScope = await call('POST', `/api/teams/${team.id}/challenges`, {
    token: coach.token,
    body: { ...monthly, scope: 'yearly' },
  });
  check('an unknown length is refused', badScope.status === 400, `got ${badScope.status}`);

  /* ---------------------------------------------------- joining is a choice */

  console.log('\n joining is a choice');
  const before = await call('GET', `/api/teams/${team.id}/challenges`, { token: alice.token });
  check('a member sees it listed', before.body.challenges.length === 1);
  check('but is not in it', before.body.challenges[0].joined === false);
  check('and it shows nobody has entered', before.body.challenges[0].entrants === 0);

  const scoreBeforeJoin = await call('PUT', `/api/teams/detail/${challenge.id}/score`, {
    token: alice.token,
    body: { score: 12 },
  });
  check('you cannot score without joining', scoreBeforeJoin.status === 409, `got ${scoreBeforeJoin.status}`);

  const boardBefore = await call('GET', `/api/teams/detail/${challenge.id}`, { token: alice.token });
  check('the board is empty before anyone joins', boardBefore.body.entries.length === 0);

  const joined = await call('POST', `/api/teams/detail/${challenge.id}/join`, { token: alice.token });
  check('joining works', joined.status === 200 && joined.body.entry.score === 0);

  const joinTwice = await call('POST', `/api/teams/detail/${challenge.id}/join`, { token: alice.token });
  check('joining twice does not reset your score', joinTwice.body.entry.id === joined.body.entry.id);

  const outsiderJoins = await call('POST', `/api/teams/detail/${challenge.id}/join`, {
    token: outsider.token,
  });
  check('an outsider cannot join', outsiderJoins.status === 403, `got ${outsiderJoins.status}`);

  const rivalReads = await call('GET', `/api/teams/detail/${challenge.id}`, { token: rival.token });
  check('another team cannot read the board', rivalReads.status === 403, `got ${rivalReads.status}`);

  /* -------------------------------------------------------------- the board */

  console.log('\n the ranking');
  for (const person of [bob, cara]) {
    await call('POST', `/api/teams/detail/${challenge.id}/join`, { token: person.token });
  }
  await call('PUT', `/api/teams/detail/${challenge.id}/score`, { token: alice.token, body: { score: 18 } });
  await call('PUT', `/api/teams/detail/${challenge.id}/score`, { token: bob.token, body: { score: 24 } });
  await call('PUT', `/api/teams/detail/${challenge.id}/score`, { token: cara.token, body: { score: 18 } });

  const board = (await call('GET', `/api/teams/detail/${challenge.id}`, { token: coach.token })).body.entries;
  check('everyone who joined is on it', board.length === 3, `got ${board.length}`);
  check('highest first', board[0].name === 'Bob' && board[0].score === 24, board[0]?.name);
  check('the leader is first', board[0].rank === 1);
  check('a tie shares a place', board[1].rank === 2 && board[2].rank === 2, `${board[1]?.rank}/${board[2]?.rank}`);

  await call('PUT', `/api/teams/detail/${challenge.id}/score`, { token: cara.token, body: { score: 29 } });
  const moved = (await call('GET', `/api/teams/detail/${challenge.id}`, { token: coach.token })).body.entries;
  check('a new score reorders the board', moved[0].name === 'Cara', moved[0]?.name);

  const negative = await call('PUT', `/api/teams/detail/${challenge.id}/score`, {
    token: alice.token,
    body: { score: -5 },
  });
  check('a negative score is refused', negative.status === 400, `got ${negative.status}`);

  /* ------------------------------------------------------------- the leak */

  console.log('\n what a score does not reveal');
  await call('PUT', '/api/state', {
    token: bob.token,
    body: {
      version: 1,
      goals: [{ id: 'g1', title: 'private goal' }],
      log: {},
      runs: [],
      plan: {},
      victories: { targets: { hygiene: 'private target' }, log: {} },
      updatedAt: Date.now(),
    },
  });
  const boardAfter = await call('GET', `/api/teams/detail/${challenge.id}`, { token: coach.token });
  const asText = JSON.stringify(boardAfter.body);
  check('the board carries a number and a name, nothing else', !asText.includes('private target'));
  check('and nothing of anyone’s goals', !asText.includes('private goal'));
  check(
    'an entry has no link back into the data',
    Object.keys(boardAfter.body.entries[0]).sort().join(',') ===
      'challengeId,id,name,rank,score,updatedAt,userId',
    Object.keys(boardAfter.body.entries[0]).join(','),
  );

  /* ---------------------------------------------------------------- leaving */

  console.log('\n stepping off');
  await call('DELETE', `/api/teams/detail/${challenge.id}/leave`, { token: alice.token });
  const afterLeave = (await call('GET', `/api/teams/detail/${challenge.id}`, { token: coach.token })).body.entries;
  check('leaving takes you off the board', afterLeave.length === 2, `got ${afterLeave.length}`);
  check('and takes your score with you', !JSON.stringify(afterLeave).includes('Alice'));

  const rejoin = await call('POST', `/api/teams/detail/${challenge.id}/join`, { token: alice.token });
  check('rejoining starts from zero', rejoin.body.entry.score === 0);

  /* ---------------------------------------------------------------- closing */

  console.log('\n closing it');
  const athleteCloses = await call('PATCH', `/api/teams/detail/${challenge.id}`, {
    token: alice.token,
    body: { archived: true },
  });
  check('an athlete cannot close it', athleteCloses.status === 403, `got ${athleteCloses.status}`);

  await call('PATCH', `/api/teams/detail/${challenge.id}`, { token: coach.token, body: { archived: true } });
  const closedList = await call('GET', `/api/teams/${team.id}/challenges`, { token: alice.token });
  check('a closed challenge drops off the list', closedList.body.challenges.length === 0);

  const closedBoard = await call('GET', `/api/teams/detail/${challenge.id}`, { token: coach.token });
  check('but its result can still be read', closedBoard.body.entries.length === 3, `got ${closedBoard.body.entries?.length}`);

  const joinClosed = await call('POST', `/api/teams/detail/${challenge.id}/join`, { token: bob.token });
  check('nobody can join a closed challenge', joinClosed.status === 403, `got ${joinClosed.status}`);

  /* --------------------------------------------------------- account delete */

  console.log('\n deleting an account');
  await call('DELETE', '/api/auth/me', { token: cara.token });
  const afterDelete = await call('GET', `/api/teams/detail/${challenge.id}`, { token: coach.token });
  check(
    'a deleted account leaves the board',
    !JSON.stringify(afterDelete.body.entries).includes('Cara'),
    JSON.stringify(afterDelete.body.entries),
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
