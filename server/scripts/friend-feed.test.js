/**
 * What your friends have shown off.
 *   node scripts/friend-feed.test.js
 *
 * The same share rows as a team wall, with no team on them. What that opens up
 * is the audience question, and it is where all the risk is:
 *
 *  1. A friend post reaches your friends and nobody else — not a teammate who
 *     is not a friend, and certainly not a stranger.
 *  2. The audience is live friendship, not a stamp on the post. Unfriending
 *     somebody takes your posts back from them.
 *  3. A team wall post does not leak onto a friend feed, or the other way.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PORT = 4202;
const base = `http://localhost:${PORT}`;
const dbFile = path.join(os.tmpdir(), `notenough-feed-${Date.now()}.json`);
const messagesFile = dbFile.replace(/\.json$/, '') + '.messages.json';

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

const anAchievement = (id, title) => ({
  kind: 'streak',
  achievementId: id,
  title,
  detail: 'Kept it going',
  value: 30,
  achievedAt: '2026-07-01',
});

/** Adds two people as friends, from both directions. */
async function befriend(a, b) {
  const code = (await call('GET', '/api/friends/code', { token: b.token })).body.code;
  await call('POST', '/api/friends/request', { token: a.token, body: { code } });
  const incoming = (await call('GET', '/api/friends', { token: b.token })).body.incoming[0];
  await call('POST', `/api/friends/${incoming.id}/accept`, { token: b.token });
  return incoming.id;
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
  console.log('\nFriend feed tests\n');

  const ada = await signUp('Ada');
  const bo = await signUp('Bo');
  const cara = await signUp('Cara');
  const stranger = await signUp('Stranger');

  const friendship = await befriend(ada, bo);

  /* ------------------------------------------------------------- posting */

  console.log(' posting to your friends');
  const anon = await call('POST', '/api/friends/shares', { body: anAchievement('a1', 'Thirty days') });
  check('posting needs a session', anon.status === 401, `got ${anon.status}`);

  const posted = await call('POST', '/api/friends/shares', {
    token: ada.token,
    body: anAchievement('a1', 'Thirty days'),
  });
  check('you can post to your friends', posted.status === 201, `got ${posted.status}`);
  check('the post belongs to no team', posted.body?.share?.teamId === null,
    JSON.stringify(posted.body?.share?.teamId));
  check('and carries the name it was posted under', posted.body?.share?.authorName === 'Ada');

  const again = await call('POST', '/api/friends/shares', {
    token: ada.token,
    body: anAchievement('a1', 'Thirty days'),
  });
  check('posting the same achievement twice is not two posts', again.status === 200,
    `got ${again.status}`);

  /* ------------------------------------------------------------- reading */

  console.log('\n who sees it');
  const mine = await call('GET', '/api/friends/feed', { token: ada.token });
  check('you see your own post', mine.body.feed.length === 1, String(mine.body.feed.length));
  check('and are told how many friends you have', mine.body.friendCount === 1);

  const theirs = await call('GET', '/api/friends/feed', { token: bo.token });
  check('your friend sees it', theirs.body.feed.some((row) => row.achievementId === 'a1'));
  check('with a face slot', 'avatarUrl' in (theirs.body.feed[0] ?? {}));

  const notAFriend = await call('GET', '/api/friends/feed', { token: stranger.token });
  check('a stranger sees nothing of yours', notAFriend.body.feed.length === 0,
    JSON.stringify(notAFriend.body.feed));
  check('and has an empty feed rather than an error', notAFriend.status === 200);

  /* ------------------------------------------- a teammate who is not a friend */

  console.log('\n a teammate is not a friend');
  const team = (await call('POST', '/api/teams', { token: ada.token, body: { name: 'Squad' } })).body
    .team;
  await call('POST', '/api/teams/join', { token: cara.token, body: { code: team.inviteCode } });

  const caraFeed = await call('GET', '/api/friends/feed', { token: cara.token });
  check('sharing a roster does not put you on their feed', caraFeed.body.feed.length === 0,
    JSON.stringify(caraFeed.body.feed));

  await call('POST', `/api/teams/${team.id}/shares`, {
    token: ada.token,
    body: anAchievement('a2', 'A team post'),
  });
  const afterTeamPost = await call('GET', '/api/friends/feed', { token: bo.token });
  check('and a team wall post does not reach the friend feed',
    !afterTeamPost.body.feed.some((row) => row.achievementId === 'a2'),
    JSON.stringify(afterTeamPost.body.feed.map((row) => row.achievementId)));

  const wall = await call('GET', `/api/teams/${team.id}/shares`, { token: cara.token });
  check('nor does a friend post reach the team wall',
    !wall.body.shares.some((row) => row.achievementId === 'a1'),
    JSON.stringify(wall.body.shares.map((row) => row.achievementId)));

  /* ------------------------------------------------------- live audience */

  console.log('\n the audience is live');
  await call('DELETE', `/api/friends/${friendship}`, { token: bo.token });
  const afterUnfriend = await call('GET', '/api/friends/feed', { token: bo.token });
  check('unfriending takes your posts back from them',
    !afterUnfriend.body.feed.some((row) => row.achievementId === 'a1'),
    JSON.stringify(afterUnfriend.body.feed));
  const stillMine = await call('GET', '/api/friends/feed', { token: ada.token });
  check('the post itself is still yours', stillMine.body.feed.length === 1);

  await befriend(ada, bo);
  const restored = await call('GET', '/api/friends/feed', { token: bo.token });
  check('and adding them back gives it to them again',
    restored.body.feed.some((row) => row.achievementId === 'a1'));

  /* ------------------------------------------------------------ deleting */

  console.log('\n taking a post down');
  const post = (await call('GET', '/api/friends/feed', { token: ada.token })).body.feed[0];
  const byFriend = await call('DELETE', `/api/friends/shares/${post.id}`, { token: bo.token });
  check('a friend cannot delete your post', byFriend.status === 403, `got ${byFriend.status}`);
  const byAuthor = await call('DELETE', `/api/friends/shares/${post.id}`, { token: ada.token });
  check('you can', byAuthor.status === 204, `got ${byAuthor.status}`);
  const gone = await call('GET', '/api/friends/feed', { token: bo.token });
  check('and it leaves every feed it was on', gone.body.feed.length === 0,
    JSON.stringify(gone.body.feed));

  /* ------------------------------------------------------ account deletion */

  console.log('\n an author who leaves');
  await call('POST', '/api/friends/shares', {
    token: bo.token,
    body: anAchievement('b1', 'Bo did a thing'),
  });
  check('their post is on your feed first',
    (await call('GET', '/api/friends/feed', { token: ada.token })).body.feed.length === 1);
  await call('DELETE', '/api/auth/me', { token: bo.token });
  const afterDelete = await call('GET', '/api/friends/feed', { token: ada.token });
  check('deleting their account takes it with them', afterDelete.body.feed.length === 0,
    JSON.stringify(afterDelete.body.feed));
} catch (error) {
  failures += 1;
  console.error('\n  [FAIL] test run threw —', error.message);
} finally {
  server.kill();
  await fs.rm(dbFile, { force: true });
  await fs.rm(messagesFile, { force: true });
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
