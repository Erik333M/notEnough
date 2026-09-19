/**
 * Profile pictures.
 *   node scripts/avatars.test.js
 *
 * The interesting checks are not "can I upload a picture". They are:
 *
 *  1. Nobody can write anybody else's. There is no route that takes a user id.
 *  2. A face is exactly as visible as the name beside it — friends and
 *     teammates, nobody else, and a pending request still grants nothing.
 *  3. The store cannot be made to write, or serve, something that is not an
 *     image: not an SVG, not a path with .. in it, not a 5 MB upload.
 *  4. Deleting an account takes the bytes off the disk, not just the row.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PORT = 4196;
const base = `http://localhost:${PORT}`;
const stamp = Date.now();
const dbFile = path.join(os.tmpdir(), `notenough-avatars-${stamp}.json`);
const avatarDir = path.join(os.tmpdir(), `notenough-avatars-${stamp}`);

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

/* ------------------------------------------------------------- test images */

/** The smallest thing the store will accept as a JPEG: real magic bytes. */
const jpeg = (tag = 0x00) =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, tag]), Buffer.alloc(64, tag)]).toString(
    'base64',
  );

const png = () =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]), Buffer.alloc(64, 7)]).toString(
    'base64',
  );

/** See the friends suite: an old server answers /api/health and 404s the rest. */
const squatter = await fetch(`${base}/api/health`).catch(() => null);
if (squatter?.ok) {
  console.error(`\nPort ${PORT} is already serving something. Kill it first:\n  lsof -ti:${PORT} | xargs kill\n`);
  process.exit(1);
}

const server = spawn('node', ['src/index.js'], {
  cwd: path.join(import.meta.dirname, '..'),
  env: {
    ...process.env,
    PORT: String(PORT),
    DB_FILE: dbFile,
    AVATAR_DIR: avatarDir,
    JWT_SECRET: 'test-secret',
  },
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
  console.log('\nAvatar tests\n');

  const ada = await signUp('Ada');
  const bo = await signUp('Bo');
  const stranger = await signUp('Stranger');

  /* ------------------------------------------------------------ uploading */

  console.log(' uploading');
  const anon = await call('PUT', '/api/avatars/me', { body: { image: jpeg() } });
  check('uploading needs a session', anon.status === 401, `got ${anon.status}`);

  const empty = await call('GET', '/api/avatars/me', { token: ada.token });
  check('you start with no picture', empty.body?.avatarUrl === null, JSON.stringify(empty.body));

  const put = await call('PUT', '/api/avatars/me', { token: ada.token, body: { image: jpeg(1) } });
  check('a JPEG is accepted', put.status === 200, `got ${put.status}`);
  const adaUrl = put.body?.avatarUrl;
  check('and comes back as a URL', /^\/api\/avatars\/[0-9a-f]{32}\.jpg$/.test(adaUrl ?? ''), String(adaUrl));

  const mine = await call('GET', '/api/avatars/me', { token: ada.token });
  check('which is then your own picture', mine.body?.avatarUrl === adaUrl);

  const asPng = await call('PUT', '/api/avatars/me', { token: bo.token, body: { image: png() } });
  check('a PNG is accepted too', /\.png$/.test(asPng.body?.avatarUrl ?? ''), JSON.stringify(asPng.body));

  /* ----------------------------------------------------- what is not an image */

  console.log('\n what is not an image');
  const svg = Buffer.from('<svg onload="alert(1)"></svg>').toString('base64');
  const asSvg = await call('PUT', '/api/avatars/me', { token: ada.token, body: { image: svg } });
  check('an SVG is refused', asSvg.status === 400, `got ${asSvg.status}`);

  const text = Buffer.from('not an image at all').toString('base64');
  const asText = await call('PUT', '/api/avatars/me', { token: ada.token, body: { image: text } });
  check('so is a text file wearing the name', asText.status === 400, `got ${asText.status}`);

  const none = await call('PUT', '/api/avatars/me', { token: ada.token, body: {} });
  check('so is nothing at all', none.status === 400, `got ${none.status}`);

  const huge = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(500 * 1024, 9)]);
  const tooBig = await call('PUT', '/api/avatars/me', {
    token: ada.token,
    body: { image: huge.toString('base64') },
  });
  check('and a half-megabyte photo', tooBig.status === 400, `got ${tooBig.status}`);

  const survived = await call('GET', '/api/avatars/me', { token: ada.token });
  check('a refused upload leaves the old one standing', survived.body?.avatarUrl === adaUrl);

  /* -------------------------------------------------------- serving bytes */

  console.log('\n serving the bytes');
  const fetched = await fetch(`${base}${adaUrl}`);
  check('the URL serves the image', fetched.status === 200, `got ${fetched.status}`);
  check('as a JPEG', fetched.headers.get('content-type')?.includes('image/jpeg') === true);
  check('cached privately', fetched.headers.get('cache-control')?.includes('private') === true);

  const traversal = await fetch(`${base}/api/avatars/..%2f..%2fdata%2fdb.json`);
  check('a path cannot climb out of the directory', traversal.status === 404, `got ${traversal.status}`);

  const unknown = await fetch(`${base}/api/avatars/${'a'.repeat(32)}.jpg`);
  check('an unused token is a 404', unknown.status === 404, `got ${unknown.status}`);

  /* ------------------------------------------------------- who can see it */

  console.log('\n who can see it');
  const asStranger = await call('GET', `/api/friends/${ada.id}/profile`, { token: stranger.token });
  check('a stranger cannot read the profile at all', asStranger.status === 403, `got ${asStranger.status}`);

  const adaCode = (await call('GET', '/api/friends/code', { token: ada.token })).body.code;
  await call('POST', '/api/friends/request', { token: bo.token, body: { code: adaCode } });

  const pending = (await call('GET', '/api/friends', { token: bo.token })).body;
  check(
    'a pending request shows no picture',
    pending.outgoing[0]?.profile?.avatarUrl === null,
    JSON.stringify(pending.outgoing[0]?.profile),
  );

  const request = (await call('GET', '/api/friends', { token: ada.token })).body.incoming[0];
  await call('POST', `/api/friends/${request.id}/accept`, { token: ada.token });

  const asFriend = await call('GET', `/api/friends/${ada.id}/profile`, { token: bo.token });
  check('a friend sees the picture', asFriend.body?.profile?.avatarUrl === adaUrl, JSON.stringify(asFriend.body));

  const list = (await call('GET', '/api/friends', { token: bo.token })).body;
  check('and it is on the friends list too', list.friends[0]?.profile?.avatarUrl === adaUrl);

  /* ---------------------------------------------------------- the roster */

  console.log('\n on a roster');
  const team = (await call('POST', '/api/teams', { token: stranger.token, body: { name: 'Squad' } }))
    .body.team;
  await call('POST', '/api/teams/join', { token: ada.token, body: { code: team.inviteCode } });
  const detail = await call('GET', `/api/teams/${team.id}`, { token: stranger.token });
  const adaRow = detail.body?.roster?.find((row) => row.userId === ada.id);
  check('a coach sees a face on the roster', adaRow?.avatarUrl === adaUrl, JSON.stringify(adaRow));
  check('and still no email beside it', adaRow !== undefined && !('email' in adaRow));

  const outsider = await call('GET', `/api/teams/${team.id}`, { token: bo.token });
  check('somebody outside the team sees no roster', outsider.status === 403, `got ${outsider.status}`);

  /* ---------------------------------------------------------- replacing */

  console.log('\n replacing and removing');
  const first = path.join(avatarDir, path.basename(adaUrl));
  const replaced = await call('PUT', '/api/avatars/me', { token: ada.token, body: { image: jpeg(2) } });
  const secondUrl = replaced.body?.avatarUrl;
  check('a new upload gets a new URL', secondUrl !== adaUrl, `${adaUrl} then ${secondUrl}`);
  check('and the old file is gone', !(await exists(first)), first);
  check('so the old URL stops working', (await fetch(`${base}${adaUrl}`)).status === 404);

  const removed = await call('DELETE', '/api/avatars/me', { token: ada.token });
  check('you can go back to initials', removed.status === 204, `got ${removed.status}`);
  check('and the file goes with it', !(await exists(path.join(avatarDir, path.basename(secondUrl)))));
  const gone = await call('GET', `/api/friends/${ada.id}/profile`, { token: bo.token });
  check('your friend sees no picture again', gone.body?.profile?.avatarUrl === null);

  /* ----------------------------------------------------- account deletion */

  console.log('\n deleting an account');
  const boUrl = (await call('GET', '/api/avatars/me', { token: bo.token })).body.avatarUrl;
  const boFile = path.join(avatarDir, path.basename(boUrl));
  check('Bo has a picture on disk to begin with', await exists(boFile), boFile);
  await call('DELETE', '/api/auth/me', { token: bo.token });
  check('deleting the account unlinks the bytes', !(await exists(boFile)), boFile);
  check('and the URL stops serving', (await fetch(`${base}${boUrl}`)).status === 404);
} catch (error) {
  failures += 1;
  console.error('\n  [FAIL] test run threw —', error.message);
} finally {
  server.kill();
  await fs.rm(dbFile, { force: true });
  await fs.rm(avatarDir, { recursive: true, force: true });
}

async function exists(file) {
  return fs.access(file).then(
    () => true,
    () => false,
  );
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
