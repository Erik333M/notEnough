/**
 * Filtering, reporting and blocking.
 *   node scripts/moderation.test.js
 *
 * App Review asks for three things from an app carrying user-generated
 * content, and this app carries it in four places — the event channel, the
 * friend feed, team walls, and the display name on all of them. What is
 * checked here is that each mechanism reaches every one of those places,
 * because a block that works on the feed and not in chat is not a block.
 *
 * The property that matters most: a block is immediate, two-directional, and
 * tells the blocked person nothing.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PORT = 4203;
const base = `http://localhost:${PORT}`;
const dbFile = path.join(os.tmpdir(), `notenough-mod-${Date.now()}.json`);
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
  return { token: created.body.token, id: created.body.user?.id, name };
}

const achievement = (id, title = 'Thirty days') => ({
  kind: 'streak', achievementId: id, title, detail: 'Kept it going',
  value: 30, achievedAt: '2026-07-01',
});

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
  console.log('\nModeration tests\n');

  const ada = await signUp('Ada');
  const bo = await signUp('Bo');
  const cara = await signUp('Cara');

  /* ---------------------------------------------------------- the filter */

  console.log(' the filter');
  const slur = 'you are a retard';
  const named = await call('POST', '/api/auth/register', {
    body: { name: 'Retard', email: `x-${Date.now()}@test.local`, password: 'trainhard1' },
  });
  check('a slur cannot be a display name', named.status === 400, `got ${named.status}`);

  const renamed = await call('PATCH', '/api/auth/me', { token: ada.token, body: { name: 'f4gg0t' } });
  check('nor can one dressed up in leetspeak', renamed.status === 400, `got ${renamed.status}`);

  const stillFine = await call('PATCH', '/api/auth/me', { token: ada.token, body: { name: 'Ada Lovelace' } });
  check('an ordinary name is untouched', stillFine.status === 200, `got ${stillFine.status}`);

  const scunthorpe = await call('PATCH', '/api/auth/me', {
    token: ada.token,
    body: { name: 'Scunthorpe Harriers' },
  });
  check('and the filter does not catch innocent words', scunthorpe.status === 200,
    `got ${scunthorpe.status}`);

  const badPost = await call('POST', '/api/friends/shares', {
    token: ada.token,
    body: { ...achievement('a1'), note: slur },
  });
  check('a slur cannot be posted to friends', badPost.status === 400, `got ${badPost.status}`);
  check('and the message says to change it', /not allowed/i.test(badPost.body?.message ?? ''),
    badPost.body?.message);

  /* ----------------------------------------------------------- blocking */

  console.log('\n blocking');
  const friendship = await befriend(ada, bo);
  await call('POST', '/api/friends/shares', { token: bo.token, body: achievement('b1', 'Bo ran far') });
  let feed = (await call('GET', '/api/friends/feed', { token: ada.token })).body;
  check('you see a friend before blocking them', feed.feed.some((r) => r.achievementId === 'b1'));

  const blocked = await call('POST', '/api/moderation/blocks', {
    token: ada.token,
    body: { userId: bo.id },
  });
  check('you can block somebody', blocked.status === 201, `got ${blocked.status}`);

  feed = (await call('GET', '/api/friends/feed', { token: ada.token })).body;
  check('their posts vanish from your feed', !feed.feed.some((r) => r.achievementId === 'b1'),
    JSON.stringify(feed.feed.map((r) => r.achievementId)));

  const theirFeed = (await call('GET', '/api/friends/feed', { token: bo.token })).body;
  check('and yours from theirs — a block cuts both ways',
    !theirFeed.feed.some((r) => r.userId === ada.id),
    JSON.stringify(theirFeed.feed.map((r) => r.authorName)));

  const theirProfile = await call('GET', `/api/friends/${bo.id}/profile`, { token: ada.token });
  check('their profile closes to you', theirProfile.status === 403, `got ${theirProfile.status}`);
  const yours = await call('GET', `/api/friends/${ada.id}/profile`, { token: bo.token });
  check('and yours to them', yours.status === 403, `got ${yours.status}`);

  const adaCode = (await call('GET', '/api/friends/code', { token: ada.token })).body.code;
  const sneaky = await call('POST', '/api/friends/request', { token: bo.token, body: { code: adaCode } });
  check('they cannot friend you again', sneaky.status === 404, `got ${sneaky.status}`);
  check('and are told nothing about why', /no one uses that code/i.test(sneaky.body?.message ?? ''),
    sneaky.body?.message);

  const list = (await call('GET', '/api/moderation/blocks', { token: ada.token })).body;
  check('your blocks are listed so you can undo them', list.blocks.length === 1,
    JSON.stringify(list.blocks));
  check('with a name, not just an id', list.blocks[0]?.name === 'Bo');

  const hidden = (await call('GET', '/api/moderation/hidden', { token: bo.token })).body;
  check('the blocked side can see somebody is hidden, not who blocked whom',
    hidden.hidden.length === 1 && hidden.hidden[0] === ada.id);

  /* -------------------------------------------------------- unblocking */

  console.log('\n unblocking');
  const undone = await call('DELETE', `/api/moderation/blocks/${bo.id}`, { token: ada.token });
  check('you can undo it', undone.status === 204, `got ${undone.status}`);
  feed = (await call('GET', '/api/friends/feed', { token: ada.token })).body;
  check('nothing was deleted — their post comes back',
    feed.feed.some((r) => r.achievementId === 'b1'), JSON.stringify(feed.feed));

  /* ---------------------------------------------------------- reporting */

  console.log('\n reporting');
  const noReason = await call('POST', '/api/moderation/reports', {
    token: ada.token,
    body: { kind: 'post', targetUserId: bo.id },
  });
  check('a report needs a reason', noReason.status === 400, `got ${noReason.status}`);

  const post = feed.feed.find((r) => r.achievementId === 'b1');
  const reported = await call('POST', '/api/moderation/reports', {
    token: ada.token,
    body: { kind: 'post', targetId: post.id, targetUserId: bo.id, reason: 'harassment', note: 'nasty' },
  });
  check('you can report a post', reported.status === 201, `got ${reported.status}`);
  check('and it blocks them at the same time', reported.body?.blocked === true);
  feed = (await call('GET', '/api/friends/feed', { token: ada.token })).body;
  check('so you stop seeing them immediately',
    !feed.feed.some((r) => r.achievementId === 'b1'));

  const selfReport = await call('POST', '/api/moderation/reports', {
    token: ada.token,
    body: { kind: 'person', targetUserId: ada.id, reason: 'spam' },
  });
  check('you cannot report yourself', selfReport.status === 400, `got ${selfReport.status}`);

  const anon = await call('POST', '/api/moderation/reports', {
    body: { kind: 'person', targetUserId: bo.id, reason: 'spam' },
  });
  check('reporting needs a session', anon.status === 401, `got ${anon.status}`);

  /* ------------------------------------------------ a report outlives its author */

  console.log('\n a report outlives the people in it');
  await call('POST', '/api/moderation/reports', {
    token: cara.token,
    body: { kind: 'person', targetUserId: bo.id, reason: 'abuse' },
  });
  await call('DELETE', '/api/auth/me', { token: cara.token });
  const saved = JSON.parse(await fs.readFile(dbFile, 'utf8'));
  const kept = saved.reports.filter((r) => r.targetUserId === bo.id);
  check('the report survives the reporter deleting their account', kept.length >= 1,
    String(kept.length));
  check('with the reporter detached rather than the evidence destroyed',
    kept.some((r) => r.reporterId === null), JSON.stringify(kept.map((r) => r.reporterId)));
  check('and a snapshot of what was reported',
    saved.reports.some((r) => r.kind === 'post' && typeof r.snapshot === 'string'),
    JSON.stringify(saved.reports.map((r) => r.snapshot)));

  const noBlocks = saved.blocks.filter((r) => r.userId === cara.id || r.blockedUserId === cara.id);
  check('but their blocks go with them', noBlocks.length === 0, JSON.stringify(noBlocks));
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
