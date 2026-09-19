/**
 * The event channel, over REST and over the socket.
 *   node scripts/event-chat.test.js
 *
 * Two properties carry most of the weight here:
 *
 *  1. Staff post, everybody at the event reads, nobody else sees anything.
 *     A camp has an age group; this is an announcements channel and not a
 *     messaging service between other people's children.
 *  2. The socket grants nothing the REST routes would not. It authenticates
 *     with a frame rather than a URL, refuses a room you are not in, and
 *     stops delivering the moment a membership ends.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';

const PORT = 4201;
const base = `http://localhost:${PORT}`;
const dbFile = path.join(os.tmpdir(), `notenough-chat-${Date.now()}.json`);
/** Derived by config.js the same way; the test must clean both up. */
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

/* ------------------------------------------------------------ socket help */

/** A socket that records every frame, so a test can wait for one to arrive. */
function open() {
  const socket = new WebSocket(`ws://localhost:${PORT}/ws`);
  const seen = [];
  socket.on('message', (raw) => {
    try {
      seen.push(JSON.parse(String(raw)));
    } catch {
      /* not ours */
    }
  });
  const closed = new Promise((resolve) => socket.on('close', (code) => resolve(code)));
  return {
    socket,
    seen,
    closed,
    ready: new Promise((resolve, reject) => {
      socket.on('open', resolve);
      socket.on('error', reject);
    }),
    send: (frame) => socket.send(JSON.stringify(frame)),
    /** Poll rather than race a timer: a frame that never comes fails the check. */
    wait: async (type, ms = 2000) => {
      const until = Date.now() + ms;
      while (Date.now() < until) {
        const hit = seen.find((frame) => frame.type === type);
        if (hit) return hit;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return null;
    },
  };
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

const sockets = [];

try {
  if (!(await waitForServer())) throw new Error('Server did not start.');
  console.log('\nEvent chat tests\n');

  const boss = await signUp('Boss');
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
      staffTarget: 1,
    },
  });
  const event = made.body.event;
  const campTeam = made.body.team;
  await call('POST', '/api/teams/join', { token: kid.token, body: { code: campTeam.inviteCode } });

  /* ---------------------------------------------------------- posting */

  console.log(' posting');
  const posted = await call('POST', `/api/events/${event.id}/messages`, {
    token: boss.token,
    body: { body: 'Breakfast at eight tomorrow.' },
  });
  check('staff can post', posted.status === 201, `got ${posted.status}`);
  check('the message carries its author', posted.body?.message?.name === 'Boss');
  check('and a face slot', 'avatarUrl' in (posted.body?.message ?? {}));

  const byKid = await call('POST', `/api/events/${event.id}/messages`, {
    token: kid.token,
    body: { body: 'can we skip it' },
  });
  check('a camper cannot post', byKid.status === 403, `got ${byKid.status}`);
  check('and is told why, not just refused', /staff/i.test(byKid.body?.message ?? ''),
    byKid.body?.message);

  const byOutsider = await call('POST', `/api/events/${event.id}/messages`, {
    token: outsider.token,
    body: { body: 'hello' },
  });
  check('somebody outside the camp cannot', byOutsider.status === 403, `got ${byOutsider.status}`);

  const empty = await call('POST', `/api/events/${event.id}/messages`, {
    token: boss.token,
    body: { body: '' },
  });
  check('an empty message is refused', empty.status === 400, `got ${empty.status}`);

  /* ---------------------------------------------------------- reading */

  console.log('\n reading');
  const kidReads = await call('GET', `/api/events/${event.id}/messages`, { token: kid.token });
  check('a camper reads the channel', kidReads.status === 200, `got ${kidReads.status}`);
  check('and sees the message', kidReads.body.messages.length === 1);
  check('but is not offered the box', kidReads.body.canPost === false);
  const bossReads = await call('GET', `/api/events/${event.id}/messages`, { token: boss.token });
  check('staff are', bossReads.body.canPost === true);

  const nosy = await call('GET', `/api/events/${event.id}/messages`, { token: outsider.token });
  check('an outsider reads nothing', nosy.status === 403, `got ${nosy.status}`);

  /* -------------------------------------------------------- the socket */

  console.log('\n the socket');
  const noAuth = open();
  sockets.push(noAuth);
  await noAuth.ready;
  noAuth.send({ type: 'subscribe', eventId: event.id });
  check('an unauthenticated socket is ignored', (await noAuth.wait('subscribed', 400)) === null);

  const badToken = open();
  sockets.push(badToken);
  await badToken.ready;
  badToken.send({ type: 'auth', token: 'not-a-token' });
  check('a bad token closes the socket', (await badToken.closed) === 4001);

  const kidSocket = open();
  sockets.push(kidSocket);
  await kidSocket.ready;
  kidSocket.send({ type: 'auth', token: kid.token });
  check('a real one is accepted', (await kidSocket.wait('ready')) !== null);

  kidSocket.send({ type: 'subscribe', eventId: event.id });
  check('and can join a camp they are in', (await kidSocket.wait('subscribed')) !== null);

  const outsiderSocket = open();
  sockets.push(outsiderSocket);
  await outsiderSocket.ready;
  outsiderSocket.send({ type: 'auth', token: outsider.token });
  await outsiderSocket.wait('ready');
  outsiderSocket.send({ type: 'subscribe', eventId: event.id });
  check('but not one they are outside', (await outsiderSocket.wait('denied')) !== null);

  /* ------------------------------------------------------- live delivery */

  console.log('\n live delivery');
  await call('POST', `/api/events/${event.id}/messages`, {
    token: boss.token,
    body: { body: 'Wear boots, it rained.' },
  });
  const pushed = await kidSocket.wait('message');
  check('a new message reaches the camper live', pushed !== null);
  check('with its text', pushed?.message?.body === 'Wear boots, it rained.', JSON.stringify(pushed));
  check('and nothing reached the outsider', !outsiderSocket.seen.some((f) => f.type === 'message'),
    JSON.stringify(outsiderSocket.seen));

  /* ------------------------------------------- a socket outlives a membership */

  console.log('\n leaving the camp');
  await call('DELETE', `/api/teams/${campTeam.id}/members/${kid.id}`, { token: kid.token });
  const before = kidSocket.seen.filter((frame) => frame.type === 'message').length;
  await call('POST', `/api/events/${event.id}/messages`, {
    token: boss.token,
    body: { body: 'Staff only now.' },
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const after = kidSocket.seen.filter((frame) => frame.type === 'message').length;
  check('somebody who left stops receiving, socket still open', after === before,
    `${before} then ${after}`);
  const readAfter = await call('GET', `/api/events/${event.id}/messages`, { token: kid.token });
  check('and cannot read the history either', readAfter.status === 403, `got ${readAfter.status}`);

  /* ------------------------------------------------------ its own file */

  console.log('\n where messages are kept');
  const core = JSON.parse(await fs.readFile(dbFile, 'utf8'));
  check('the database file holds no messages', core.messages === undefined,
    JSON.stringify(Object.keys(core).filter((key) => key === 'messages')));
  const kept = JSON.parse(await fs.readFile(messagesFile, 'utf8'));
  check('they are in a file of their own', Array.isArray(kept) && kept.length > 0,
    String(kept?.length));

  /*
   * The whole reason for the split. Posting used to rewrite every team,
   * session and result in the system; if that is still happening, this fails.
   */
  const coreStamp = (await fs.stat(dbFile)).mtimeMs;
  await new Promise((resolve) => setTimeout(resolve, 20));
  await call('POST', `/api/events/${event.id}/messages`, {
    token: boss.token,
    body: { body: 'Another one.' },
  });
  const coreStampAfter = (await fs.stat(dbFile)).mtimeMs;
  check('posting does not rewrite the database file', coreStampAfter === coreStamp,
    `${coreStamp} then ${coreStampAfter}`);
  const grew = JSON.parse(await fs.readFile(messagesFile, 'utf8'));
  check('only the messages file grew', grew.length === kept.length + 1,
    `${kept.length} then ${grew.length}`);

  /* ------------------------------------------------ an author who leaves */

  console.log('\n an author who deletes their account');
  const helper = await signUp('Helper');
  await call('POST', '/api/teams/join', { token: helper.token, body: { code: campTeam.inviteCode } });
  await call('PATCH', `/api/teams/${campTeam.id}/members/${helper.id}`, {
    token: boss.token,
    body: { role: 'coach' },
  });
  await call('POST', `/api/events/${event.id}/messages`, {
    token: helper.token,
    body: { body: 'Coach trip leaves at ten.' },
  });
  await call('DELETE', '/api/auth/me', { token: helper.token });

  const orphaned = (await call('GET', `/api/events/${event.id}/messages`, { token: boss.token })).body;
  const theirs = orphaned.messages.find((row) => row.body === 'Coach trip leaves at ten.');
  /*
   * Kept, unlike a share. A shared boast is about its author and is a ghost
   * without one; an announcement is information other people were given and
   * may still be relying on. It loses the name rather than the message, and
   * staff can still delete it — which was the reason shares could not stay.
   */
  check('their announcement survives them', Boolean(theirs), JSON.stringify(orphaned.messages));
  check('but no longer carries a name', theirs?.name === 'Someone', theirs?.name);
  const sweep = await call('DELETE', `/api/events/${event.id}/messages/${theirs.id}`, {
    token: boss.token,
  });
  check('and staff can still take it down', sweep.status === 204, `got ${sweep.status}`);

  /* ------------------------------------------------------------ deleting */

  console.log('\n taking a message back');
  const mine = (await call('GET', `/api/events/${event.id}/messages`, { token: boss.token })).body
    .messages[0];
  const pulled = await call('DELETE', `/api/events/${event.id}/messages/${mine.id}`, {
    token: boss.token,
  });
  check('staff can delete a message', pulled.status === 204, `got ${pulled.status}`);
  const left = await call('GET', `/api/events/${event.id}/messages`, { token: boss.token });
  check('and it goes', !left.body.messages.some((row) => row.id === mine.id));
} catch (error) {
  failures += 1;
  console.error('\n  [FAIL] test run threw —', error.message);
} finally {
  for (const entry of sockets) entry.socket.close();
  server.kill();
  await fs.rm(dbFile, { force: true });
  await fs.rm(messagesFile, { force: true });
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
