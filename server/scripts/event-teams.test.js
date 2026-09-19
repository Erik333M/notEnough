/**
 * Squads inside an event.
 *   node scripts/event-teams.test.js
 *
 * A squad is an ordinary team with a parent, so most of these checks are that
 * being a child changed nothing dangerous:
 *
 *  1. One person, one squad. Moving somebody takes them out of the old one.
 *  2. A squad is filled by staff, never by its code.
 *  3. A squad never appears in anybody's ordinary team list.
 *  4. Only somebody actually at the camp can be put in one.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PORT = 4198;
const base = `http://localhost:${PORT}`;
const dbFile = path.join(os.tmpdir(), `notenough-event-teams-${Date.now()}.json`);

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
  console.log('\nEvent squad tests\n');

  const organiser = await signUp('Organiser');
  const ann = await signUp('Ann');
  const ben = await signUp('Ben');
  const cal = await signUp('Cal');
  const outsider = await signUp('Outsider');

  const made = await call('POST', '/api/events', {
    token: organiser.token,
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
  const event = made.body.event;
  const campTeam = made.body.team;
  const join = (who) =>
    call('POST', '/api/teams/join', { token: who.token, body: { code: campTeam.inviteCode } });
  await join(ann);
  await join(ben);
  await join(cal);

  /* -------------------------------------------------------------- making */

  console.log(' making squads');
  const byCamper = await call('POST', `/api/events/${event.id}/teams`, {
    token: ann.token,
    body: { name: 'Red' },
  });
  check('a camper cannot make a squad', byCamper.status === 403, `got ${byCamper.status}`);

  const red = await call('POST', `/api/events/${event.id}/teams`, {
    token: organiser.token,
    body: { name: 'Red' },
  });
  check('staff can', red.status === 201, `got ${red.status}`);
  const blue = (await call('POST', `/api/events/${event.id}/teams`, {
    token: organiser.token,
    body: { name: 'Blue' },
  })).body;
  check('and a second one', blue?.team?.name === 'Blue');

  const nameless = await call('POST', `/api/events/${event.id}/teams`, {
    token: organiser.token,
    body: { name: '' },
  });
  check('a squad needs a name', nameless.status === 400, `got ${nameless.status}`);

  const byOutsider = await call('GET', `/api/events/${event.id}/teams`, { token: outsider.token });
  check('somebody outside the camp sees none of it', byOutsider.status === 403, `got ${byOutsider.status}`);

  /* ------------------------------------------------------------- filling */

  console.log('\n filling them');
  const put = (team, who, token = organiser.token) =>
    call('PUT', `/api/events/${event.id}/teams/${team.team.id}/members/${who.id}`, { token });

  check('staff can place a camper', (await put(red.body, ann)).status === 200);
  await put(red.body, ben);
  const listed = await call('GET', `/api/events/${event.id}/teams`, { token: ann.token });
  const redNow = listed.body.squads.find((row) => row.team.id === red.body.team.id);
  check('and the squad shows them', redNow?.members?.length === 2, String(redNow?.members?.length));
  check('with a name and a face slot', redNow.members.every((row) => 'name' in row && 'avatarUrl' in row));
  check('but never an email', !JSON.stringify(redNow.members).includes('@'));

  check('every camper starts unassigned', listed.body.unassigned.length === 1,
    JSON.stringify(listed.body.unassigned.map((row) => row.name)));
  check('and the one left is Cal', listed.body.unassigned[0]?.name === 'Cal');

  const camperMoves = await put(blue, ann, ann.token);
  check('a camper cannot move themselves', camperMoves.status === 403, `got ${camperMoves.status}`);

  const stranger = await put(red.body, outsider);
  check('somebody not at the camp cannot be placed', stranger.status === 400, `got ${stranger.status}`);

  /* ------------------------------------------------------ one squad each */

  console.log('\n one squad each');
  await put(blue, ann);
  const afterMove = (await call('GET', `/api/events/${event.id}/teams`, { token: organiser.token })).body;
  const redAfter = afterMove.squads.find((row) => row.team.id === red.body.team.id);
  const blueAfter = afterMove.squads.find((row) => row.team.id === blue.team.id);
  check('moving somebody takes them out of the old squad',
    !redAfter.members.some((row) => row.userId === ann.id), JSON.stringify(redAfter.members));
  check('and puts them in the new one', blueAfter.members.some((row) => row.userId === ann.id));
  check('so nobody is ever on two', afterMove.squads.flatMap((row) => row.members)
    .filter((row) => row.userId === ann.id).length === 1);

  const removed = await call(
    'DELETE',
    `/api/events/${event.id}/teams/${blue.team.id}/members/${ann.id}`,
    { token: organiser.token },
  );
  check('staff can take somebody out again', removed.status === 200, `got ${removed.status}`);
  const backOut = (await call('GET', `/api/events/${event.id}/teams`, { token: organiser.token })).body;
  check('and they go back to unassigned',
    backOut.unassigned.some((row) => row.userId === ann.id),
    JSON.stringify(backOut.unassigned.map((row) => row.name)));
  check('still at the camp, though',
    (await call('GET', `/api/events/${event.id}`, { token: ann.token })).status === 200);

  /* ------------------------------------------------------ not a real team */

  console.log('\n a squad is not a team you can find');
  const annTeams = await call('GET', '/api/teams', { token: ann.token });
  check('a squad never shows in your team list', annTeams.body.teams.length === 0,
    JSON.stringify(annTeams.body.teams.map((row) => row.team.name)));

  const squadCode = (await call('GET', `/api/events/${event.id}/teams`, { token: organiser.token }))
    .body.squads[0].team.inviteCode;
  const byCode = await call('POST', '/api/teams/join', {
    token: outsider.token,
    body: { code: squadCode },
  });
  check('and its code lets nobody in', byCode.status === 404, `got ${byCode.status}`);

  /* ----------------------------------------------------------- disbanding */

  console.log('\n disbanding');
  await put(red.body, cal);
  const gone = await call('PATCH', `/api/events/${event.id}/teams/${red.body.team.id}`, {
    token: organiser.token,
    body: { archived: true },
  });
  check('staff can disband a squad', gone.status === 200, `got ${gone.status}`);
  const afterDisband = (await call('GET', `/api/events/${event.id}/teams`, { token: organiser.token })).body;
  check('it leaves the list', !afterDisband.squads.some((row) => row.team.id === red.body.team.id));
  check('and its members go back to unassigned',
    afterDisband.unassigned.some((row) => row.userId === cal.id),
    JSON.stringify(afterDisband.unassigned.map((row) => row.name)));
  check('nobody is thrown out of the camp',
    (await call('GET', `/api/events/${event.id}`, { token: cal.token })).status === 200);

  const renamed = await call('PATCH', `/api/events/${event.id}/teams/${blue.team.id}`, {
    token: organiser.token,
    body: { name: 'Blue Team' },
  });
  check('and rename one', renamed.body?.team?.name === 'Blue Team', renamed.body?.team?.name);

  const camperRenames = await call('PATCH', `/api/events/${event.id}/teams/${blue.team.id}`, {
    token: ann.token,
    body: { name: 'Anns Team' },
  });
  check('a camper cannot', camperRenames.status === 403, `got ${camperRenames.status}`);
} catch (error) {
  failures += 1;
  console.error('\n  [FAIL] test run threw —', error.message);
} finally {
  server.kill();
  await fs.rm(dbFile, { force: true });
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
