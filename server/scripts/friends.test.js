/**
 * Friends, codes and published profiles.
 *   node scripts/friends.test.js
 *
 * Two properties matter more than the rest here, and most of the checks below
 * exist to hold them:
 *
 *  1. There is no directory. You cannot find a person by email or by name, so
 *     this feature cannot be used to learn who has an account — which the
 *     sign-in routes go to some trouble to prevent.
 *  2. A pending request grants nothing. Asking is a question, not an entry.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PORT = 4193;
const base = `http://localhost:${PORT}`;
const dbFile = path.join(os.tmpdir(), `notenough-friends-${Date.now()}.json`);

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
  return { token: created.body.token, id: created.body.user.id, name, email: created.body.user.email };
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

try {
  if (!(await waitForServer())) throw new Error('Server did not start.');
  console.log('\nFriend tests\n');

  const ada = await signUp('Ada');
  const bo = await signUp('Bo');
  const cara = await signUp('Cara');
  const stranger = await signUp('Stranger');

  /* ------------------------------------------------------------ the code */

  console.log(' codes');
  const adaCode = (await call('GET', '/api/friends/code', { token: ada.token })).body.code;
  const boCode = (await call('GET', '/api/friends/code', { token: bo.token })).body.code;
  check('a code is issued on request', /^[A-HJ-NP-Z2-9]{6}$/.test(adaCode), adaCode);
  check('two people get different codes', adaCode !== boCode);
  const again = (await call('GET', '/api/friends/code', { token: ada.token })).body.code;
  check('the code is stable', again === adaCode, `${adaCode} then ${again}`);

  const anon = await call('GET', '/api/friends/code');
  check('a code needs a session', anon.status === 401, `got ${anon.status}`);

  /* ------------------------------------------------------- no directory */

  console.log('\n there is no directory');
  const byEmail = await call('POST', '/api/friends/request', {
    token: bo.token,
    body: { code: ada.email },
  });
  check('you cannot request by email', byEmail.status === 400, `got ${byEmail.status}`);

  const byName = await call('POST', '/api/friends/request', {
    token: bo.token,
    body: { code: 'Ada' },
  });
  check('nor by name', byName.status === 400, `got ${byName.status}`);

  const wrongCode = await call('POST', '/api/friends/request', {
    token: bo.token,
    body: { code: 'ZZZZZZ' },
  });
  check('a code belonging to nobody is a plain 404', wrongCode.status === 404, `got ${wrongCode.status}`);
  check(
    'and says nothing about who does exist',
    !JSON.stringify(wrongCode.body).includes('@'),
    JSON.stringify(wrongCode.body),
  );

  const own = await call('POST', '/api/friends/request', {
    token: ada.token,
    body: { code: adaCode },
  });
  check('you cannot friend yourself', own.status === 400, `got ${own.status}`);

  /* ------------------------------------------------------------ asking */

  console.log('\n asking, and answering');
  const asked = await call('POST', '/api/friends/request', {
    token: bo.token,
    body: { code: adaCode },
  });
  check('a request can be sent with a code', asked.status === 201);
  check('and starts pending', asked.body.friendship.status === 'pending');

  const boList = (await call('GET', '/api/friends', { token: bo.token })).body;
  check('the asker sees it as outgoing', boList.outgoing.length === 1 && boList.friends.length === 0);
  const adaList = (await call('GET', '/api/friends', { token: ada.token })).body;
  check('the asked sees it as incoming', adaList.incoming.length === 1);
  check('and can see who is asking', adaList.incoming[0].profile.name === 'Bo');

  const beforeAccept = await call('GET', `/api/friends/${ada.id}/profile`, { token: bo.token });
  check(
    'a pending request grants no profile',
    beforeAccept.status === 403,
    `got ${beforeAccept.status}`,
  );

  const wrongPersonAccepts = await call('POST', `/api/friends/${asked.body.friendship.id}/accept`, {
    token: cara.token,
  });
  check('a third party cannot accept', wrongPersonAccepts.status === 403, `got ${wrongPersonAccepts.status}`);

  const askerAccepts = await call('POST', `/api/friends/${asked.body.friendship.id}/accept`, {
    token: bo.token,
  });
  check('the asker cannot accept their own request', askerAccepts.status === 403, `got ${askerAccepts.status}`);

  const accepted = await call('POST', `/api/friends/${asked.body.friendship.id}/accept`, {
    token: ada.token,
  });
  check('the person asked can accept', accepted.status === 200 && accepted.body.friendship.status === 'accepted');

  /* ---------------------------------------------------------- profiles */

  console.log('\n published figures');
  await call('PUT', '/api/friends/profile', {
    token: ada.token,
    body: { streak: 34, level: 4, daysWon: 96 },
  });

  const seen = await call('GET', `/api/friends/${ada.id}/profile`, { token: bo.token });
  check('a friend can read the figures', seen.status === 200 && seen.body.profile.streak === 34);
  check('including the level', seen.body.profile.level === 4);
  check('and the name', seen.body.profile.name === 'Ada');
  check(
    'and nothing else at all',
    Object.keys(seen.body.profile).sort().join(',') === 'daysWon,level,name,streak,updatedAt,userId',
    Object.keys(seen.body.profile).join(','),
  );

  const outsiderReads = await call('GET', `/api/friends/${ada.id}/profile`, { token: stranger.token });
  check('a stranger cannot read them', outsiderReads.status === 403, `got ${outsiderReads.status}`);

  const unpublished = await call('GET', `/api/friends/${bo.id}/profile`, { token: ada.token });
  check('someone who published nothing reads as zero', unpublished.body.profile.streak === 0);
  check('never as a guess from the server', unpublished.body.profile.updatedAt === null);

  const writeTheirs = await call('PUT', '/api/friends/profile', {
    token: stranger.token,
    body: { streak: 999, level: 99, daysWon: 999 },
  });
  const adaStill = await call('GET', `/api/friends/${ada.id}/profile`, { token: bo.token });
  check('publishing only ever writes your own', writeTheirs.status === 200 && adaStill.body.profile.streak === 34);

  const badLevel = await call('PUT', '/api/friends/profile', {
    token: ada.token,
    body: { streak: 1, level: 5000, daysWon: 1 },
  });
  check('an absurd level is refused', badLevel.status === 400, `got ${badLevel.status}`);

  /* ---------------------------------------------- training stays private */

  console.log('\n training stays private');
  await call('PUT', '/api/state', {
    token: ada.token,
    body: {
      version: 1,
      goals: [{ id: 'g1', title: 'private goal' }],
      log: {},
      runs: [],
      plan: {},
      victories: { targets: { hygiene: 'private target' }, log: { '2026-09-16': {} } },
      updatedAt: Date.now(),
    },
  });
  const afterState = await call('GET', `/api/friends/${ada.id}/profile`, { token: bo.token });
  const asText = JSON.stringify(afterState.body);
  check('a friend still sees only the figures', !asText.includes('private goal'));
  check('and nothing of the victories behind them', !asText.includes('private target'));

  const friendReadsState = await call('GET', '/api/state', { token: bo.token });
  check(
    'and cannot read their state at all',
    friendReadsState.body.state === null,
    JSON.stringify(friendReadsState.body.state)?.slice(0, 80),
  );

  /* ------------------------------------------------------------ undoing */

  console.log('\n undoing');
  const mutual = await call('POST', '/api/friends/request', {
    token: cara.token,
    body: { code: boCode },
  });
  const boTakesCaras = await call('POST', '/api/friends/request', {
    token: bo.token,
    body: { code: (await call('GET', '/api/friends/code', { token: cara.token })).body.code },
  });
  check(
    'using the code of someone who already asked you accepts them',
    boTakesCaras.body.friendship.status === 'accepted',
    boTakesCaras.body.friendship?.status,
  );
  check('and does not create a second friendship', boTakesCaras.body.friendship.id === mutual.body.friendship.id);

  const strangerRemoves = await call('DELETE', `/api/friends/${accepted.body.friendship.id}`, {
    token: stranger.token,
  });
  check('a stranger cannot unfriend other people', strangerRemoves.status === 403, `got ${strangerRemoves.status}`);

  const removed = await call('DELETE', `/api/friends/${accepted.body.friendship.id}`, {
    token: bo.token,
  });
  check('either side can unfriend', removed.status === 204, `got ${removed.status}`);

  const afterRemoval = await call('GET', `/api/friends/${ada.id}/profile`, { token: bo.token });
  check('and the profile closes immediately', afterRemoval.status === 403, `got ${afterRemoval.status}`);

  /* --------------------------------------------------- from a team roster */

  console.log('\n adding from a roster');
  const coach = await signUp('Coach');
  const team = (await call('POST', '/api/teams', { token: coach.token, body: { name: 'Squad' } })).body.team;
  for (const person of [ada, stranger]) {
    await call('POST', '/api/teams/join', { token: person.token, body: { code: team.inviteCode } });
  }

  const notTeammates = await call('POST', '/api/friends/request-teammate', {
    token: ada.token,
    body: { userId: bo.id },
  });
  check(
    'you cannot add someone you share no team with',
    notTeammates.status === 403,
    `got ${notTeammates.status}`,
  );

  const guessedId = await call('POST', '/api/friends/request-teammate', {
    token: ada.token,
    body: { userId: 'not-a-real-user' },
  });
  check('nor an id you invented', guessedId.status === 403, `got ${guessedId.status}`);

  const self = await call('POST', '/api/friends/request-teammate', {
    token: ada.token,
    body: { userId: ada.id },
  });
  check('nor yourself', self.status === 400, `got ${self.status}`);

  const teammate = await call('POST', '/api/friends/request-teammate', {
    token: ada.token,
    body: { userId: stranger.id },
  });
  check('but you can add a teammate', teammate.status === 201, `got ${teammate.status}`);
  check('and it still starts pending', teammate.body.friendship.status === 'pending');

  const stillPrivate = await call('GET', `/api/friends/${ada.id}/profile`, { token: stranger.token });
  check(
    'adding from a roster grants nothing until accepted',
    stillPrivate.status === 403,
    `got ${stillPrivate.status}`,
  );

  const afterLeaving = await call('DELETE', `/api/teams/${team.id}/members/${stranger.id}`, {
    token: stranger.token,
  });
  const retry = await call('POST', '/api/friends/request-teammate', {
    token: coach.token,
    body: { userId: stranger.id },
  });
  check(
    'leaving the team closes that route again',
    afterLeaving.status === 204 && retry.status === 403,
    `got ${retry.status}`,
  );

  /* ------------------------------------------------------ account delete */

  console.log('\n deleting an account');
  await call('DELETE', '/api/auth/me', { token: cara.token });
  const boAfter = (await call('GET', '/api/friends', { token: bo.token })).body;
  check(
    'a deleted account leaves no dangling friendship',
    boAfter.friends.length === 0 && boAfter.incoming.length === 0 && boAfter.outgoing.length === 0,
    JSON.stringify(boAfter),
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
