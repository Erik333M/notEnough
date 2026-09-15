/**
 * Sharing an achievement with a team.
 *   node scripts/shares.test.js
 *
 * This is the only route by which somebody's own training becomes visible to
 * anyone else, and it happens solely because they asked for it. So the checks
 * here are mostly about what does NOT happen: no cross-team leakage, no
 * posting into a team you are not in, no deleting somebody else's post.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PORT = 4195;
const base = `http://localhost:${PORT}`;
const dbFile = path.join(os.tmpdir(), `notenough-shares-${Date.now()}.json`);

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

const achievement = {
  kind: 'personalBest',
  achievementId: 'pb:deadlift:2026-09-15',
  title: 'New best: Deadlift',
  detail: '140 kg, up from 132.5 kg',
  value: 140,
  achievedAt: '2026-09-15',
};

try {
  if (!(await waitForServer())) throw new Error('Server did not start.');
  console.log('\nSharing tests\n');

  const coach = await signUp('Coach');
  const alice = await signUp('Alice');
  const bob = await signUp('Bob');
  const rival = await signUp('Rival');
  const outsider = await signUp('Outsider');

  const team = (await call('POST', '/api/teams', { token: coach.token, body: { name: 'Squad' } })).body.team;
  const other = (await call('POST', '/api/teams', { token: rival.token, body: { name: 'Others' } })).body.team;
  for (const person of [alice, bob]) {
    await call('POST', '/api/teams/join', { token: person.token, body: { code: team.inviteCode } });
  }
  // Alice is on both rosters — the case where a leak would actually happen.
  await call('POST', '/api/teams/join', { token: alice.token, body: { code: other.inviteCode } });

  /* --------------------------------------------------------------- posting */

  console.log(' posting');
  const posted = await call('POST', `/api/teams/${team.id}/shares`, {
    token: alice.token,
    body: { ...achievement, note: 'Finally.' },
  });
  check('an athlete can share to their team', posted.status === 201, `got ${posted.status}`);
  check('the post carries the author’s name', posted.body.share.authorName === 'Alice');
  check('the post keeps its note', posted.body.share.note === 'Finally.');

  const again = await call('POST', `/api/teams/${team.id}/shares`, {
    token: alice.token,
    body: achievement,
  });
  check('posting the same achievement twice does not duplicate', again.status === 200);
  check('and returns the original', again.body.share.id === posted.body.share.id);

  const intruder = await call('POST', `/api/teams/${team.id}/shares`, {
    token: outsider.token,
    body: achievement,
  });
  check('an outsider cannot post to a team', intruder.status === 403, `got ${intruder.status}`);

  const badKind = await call('POST', `/api/teams/${team.id}/shares`, {
    token: alice.token,
    body: { ...achievement, kind: 'somethingElse' },
  });
  check('an unknown achievement kind is refused', badKind.status === 400, `got ${badKind.status}`);

  const coachPost = await call('POST', `/api/teams/${team.id}/shares`, {
    token: coach.token,
    body: { ...achievement, achievementId: 'streak:30', kind: 'streak', title: '30 day streak' },
  });
  check('a coach can share too', coachPost.status === 201);

  /* --------------------------------------------------------------- reading */

  console.log('\n reading the feed');
  const feed = await call('GET', `/api/teams/${team.id}/shares`, { token: bob.token });
  check('a teammate sees the feed', feed.status === 200 && feed.body.shares.length === 2, `${feed.body.shares?.length}`);
  check('newest first', feed.body.shares[0].createdAt >= feed.body.shares[1].createdAt);

  const outsiderFeed = await call('GET', `/api/teams/${team.id}/shares`, { token: outsider.token });
  check('an outsider cannot read the feed', outsiderFeed.status === 403, `got ${outsiderFeed.status}`);

  const rivalFeed = await call('GET', `/api/teams/${other.id}/shares`, { token: rival.token });
  check(
    'the other team sees nothing of it, though Alice is in both',
    rivalFeed.body.shares.length === 0,
    JSON.stringify(rivalFeed.body.shares),
  );

  const anon = await call('GET', `/api/teams/${team.id}/shares`);
  check('an unauthenticated read is rejected', anon.status === 401, `got ${anon.status}`);

  /* -------------------------------------------------------------- removing */

  console.log('\n taking it down');
  const bobDeletes = await call('DELETE', `/api/teams/${team.id}/shares/${posted.body.share.id}`, {
    token: bob.token,
  });
  check('a teammate cannot delete someone’s post', bobDeletes.status === 403, `got ${bobDeletes.status}`);

  const coachDeletes = await call('DELETE', `/api/teams/${team.id}/shares/${posted.body.share.id}`, {
    token: coach.token,
  });
  check('a coach can moderate the feed', coachDeletes.status === 204, `got ${coachDeletes.status}`);

  const authorDeletes = await call('DELETE', `/api/teams/${team.id}/shares/${coachPost.body.share.id}`, {
    token: coach.token,
  });
  check('the author can take their own down', authorDeletes.status === 204);

  const empty = await call('GET', `/api/teams/${team.id}/shares`, { token: bob.token });
  check('the feed is empty again', empty.body.shares.length === 0);

  /* -------------------------------------------------- nothing shares itself */

  console.log('\n nothing shares itself');
  await call('PUT', '/api/state', {
    token: bob.token,
    body: {
      version: 1,
      goals: [{ id: 'g1', title: 'private goal' }],
      log: {},
      runs: [],
      plan: {},
      journey: { entries: { '2026-09-15': { story: 'private story' } } },
      updatedAt: Date.now(),
    },
  });
  const afterState = await call('GET', `/api/teams/${team.id}/shares`, { token: coach.token });
  check(
    'saving private training publishes nothing',
    afterState.body.shares.length === 0,
    JSON.stringify(afterState.body.shares),
  );

  const bobPost = await call('POST', `/api/teams/${team.id}/shares`, {
    token: bob.token,
    body: { ...achievement, achievementId: 'pb:squat', title: 'New best: Squat' },
  });
  const coachSees = await call('GET', `/api/teams/${team.id}/shares`, { token: coach.token });
  check('a deliberate share does appear', coachSees.body.shares.length === 1);
  check(
    'and carries only the snapshot, not a way back into the data',
    !JSON.stringify(coachSees.body.shares).includes('private story') &&
      !JSON.stringify(coachSees.body.shares).includes('private goal'),
  );
  check('the snapshot is what was posted', coachSees.body.shares[0].title === 'New best: Squat');

  /* --------------------------------------------------- leaving and deleting */

  console.log('\n leaving and deleting');
  await call('DELETE', `/api/teams/${team.id}/members/${bob.id}`, { token: bob.token });
  const afterLeave = await call('GET', `/api/teams/${team.id}/shares`, { token: coach.token });
  check(
    'leaving leaves your posts standing',
    afterLeave.body.shares.length === 1,
    'a post is a thing you said to the team, not a live window',
  );
  check('but the feed itself is closed to you', (await call('GET', `/api/teams/${team.id}/shares`, { token: bob.token })).status === 403);

  await call('DELETE', '/api/auth/me', { token: bobPost.status === 201 ? bob.token : bob.token });
  const afterDelete = await call('GET', `/api/teams/${team.id}/shares`, { token: coach.token });
  check(
    'deleting your account removes your posts',
    afterDelete.body.shares.length === 0,
    JSON.stringify(afterDelete.body.shares),
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
