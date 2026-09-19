/**
 * Events — camps, training weeks, competition weekends.
 *   node scripts/events.test.js
 *
 * An event is a team with dates, an age group and a ceiling. Most of what is
 * checked below is that being an event changed nothing underneath it:
 *
 *  1. The same roles, the same roster rules, the same 403 for an outsider.
 *  2. An ordinary team still has no ceiling and never sees one.
 *  3. Only staff can change the shape of an event.
 *  4. The last coach cannot be demoted, or an event becomes unadministrable.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PORT = 4197;
const base = `http://localhost:${PORT}`;
const dbFile = path.join(os.tmpdir(), `notenough-events-${Date.now()}.json`);

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

const camp = (over = {}) => ({
  name: 'Summer Camp',
  startDate: '2026-07-01',
  endDate: '2026-07-10',
  ageMin: 10,
  ageMax: 14,
  capacity: 2,
  staffTarget: 3,
  ...over,
});

/** See the friends suite: an old server answers /api/health and 404s the rest. */
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
  console.log('\nEvent tests\n');

  const organiser = await signUp('Organiser');
  const helper = await signUp('Helper');
  const kid = await signUp('Kid');
  const second = await signUp('Second');
  const third = await signUp('Third');
  const outsider = await signUp('Outsider');

  /* ------------------------------------------------------------- creating */

  console.log(' creating one');
  const anon = await call('POST', '/api/events', { body: camp() });
  check('creating needs a session', anon.status === 401, `got ${anon.status}`);

  const made = await call('POST', '/api/events', { token: organiser.token, body: camp() });
  check('anybody can create an event', made.status === 201, `got ${made.status}`);
  check('the creator is its first staff member', made.body?.role === 'coach');
  check('it lasts the days between its dates', made.body?.days === 10, String(made.body?.days));
  check('and starts with one staff, no campers',
    made.body?.counts?.staff === 1 && made.body?.counts?.campers === 0,
    JSON.stringify(made.body?.counts));

  const event = made.body.event;
  const team = made.body.team;

  /* ------------------------------------------------------------- duration */

  console.log('\n duration');
  const oneDay = await call('POST', '/api/events', {
    token: organiser.token,
    body: camp({ startDate: '2026-07-01', endDate: '2026-07-01' }),
  });
  check('a single day is one day, not zero', oneDay.body?.days === 1, String(oneDay.body?.days));

  const sixty = await call('POST', '/api/events', {
    token: organiser.token,
    body: camp({ startDate: '2026-07-01', endDate: '2026-08-29' }),
  });
  check('sixty days is allowed', sixty.status === 201 && sixty.body.days === 60, String(sixty.body?.days));

  const sixtyOne = await call('POST', '/api/events', {
    token: organiser.token,
    body: camp({ startDate: '2026-07-01', endDate: '2026-08-30' }),
  });
  check('sixty-one is not', sixtyOne.status === 400, `got ${sixtyOne.status}`);

  const backwards = await call('POST', '/api/events', {
    token: organiser.token,
    body: camp({ startDate: '2026-07-10', endDate: '2026-07-01' }),
  });
  check('nor can it end before it starts', backwards.status === 400, `got ${backwards.status}`);

  const notADate = await call('POST', '/api/events', {
    token: organiser.token,
    body: camp({ startDate: 'soon' }),
  });
  check('nor run from "soon"', notADate.status === 400, `got ${notADate.status}`);

  /* ------------------------------------------------------------ age group */

  console.log('\n age group');
  check('it carries the ages it is for', event.ageMin === 10 && event.ageMax === 14);
  const backwardsAge = await call('POST', '/api/events', {
    token: organiser.token,
    body: camp({ ageMin: 16, ageMax: 12 }),
  });
  check('the oldest cannot be below the youngest', backwardsAge.status === 400, `got ${backwardsAge.status}`);

  /* ------------------------------------------------------------- capacity */

  console.log('\n capacity');
  const join = (who) => call('POST', '/api/teams/join', { token: who.token, body: { code: team.inviteCode } });

  check('the first camper joins', (await join(kid)).status === 200);
  check('so does the second', (await join(second)).status === 200);
  const full = await join(third);
  check('the third goes on the waiting list', full.body?.status === 'pending', JSON.stringify(full.body));
  const waitingSees = await call('GET', `/api/events/${event.id}`, { token: third.token });
  check('and waiting grants nothing at all', waitingSees.status === 403, `got ${waitingSees.status}`);
  const admit = await call('PATCH', `/api/teams/${team.id}/members/${third.id}`, {
    token: organiser.token,
    body: { status: 'active' },
  });
  check('staff cannot admit them past the ceiling either', admit.status === 400, `got ${admit.status}`);

  const counted = await call('GET', `/api/events/${event.id}`, { token: organiser.token });
  check('the count is campers only, not staff', counted.body?.counts?.campers === 2,
    JSON.stringify(counted.body?.counts));

  const plainTeam = (await call('POST', '/api/teams', { token: organiser.token, body: { name: 'Squad' } })).body.team;
  const intoPlain = await call('POST', '/api/teams/join', {
    token: third.token,
    body: { code: plainTeam.inviteCode },
  });
  check('an ordinary team still has no ceiling', intoPlain.status === 200, `got ${intoPlain.status}`);

  /* ---------------------------------------------------------------- staff */

  console.log('\n staff');
  const helperJoin = await join(helper);
  check('a full camp still takes on an adult', helperJoin.body?.status === 'pending',
    JSON.stringify(helperJoin.body));
  const promote = await call('PATCH', `/api/teams/${team.id}/members/${helper.id}`, {
    token: organiser.token,
    body: { role: 'coach' },
  });
  check('the organiser can make somebody staff', promote.status === 200, `got ${promote.status}`);
  check('and promoting admits them, because staff take no camper place',
    promote.body?.membership?.status === 'active', JSON.stringify(promote.body?.membership));

  const afterPromote = await call('GET', `/api/events/${event.id}`, { token: organiser.token });
  check('staff count follows', afterPromote.body?.counts?.staff === 2,
    JSON.stringify(afterPromote.body?.counts));
  check('and they stop taking a camper place', afterPromote.body?.counts?.campers === 2,
    JSON.stringify(afterPromote.body?.counts));

  const camperPromotes = await call('PATCH', `/api/teams/${team.id}/members/${kid.id}`, {
    token: kid.token,
    body: { role: 'coach' },
  });
  check('a camper cannot promote themselves', camperPromotes.status === 403, `got ${camperPromotes.status}`);

  const nonsenseRole = await call('PATCH', `/api/teams/${team.id}/members/${kid.id}`, {
    token: organiser.token,
    body: { role: 'director' },
  });
  check('and there is no third role', nonsenseRole.status === 400, `got ${nonsenseRole.status}`);

  await call('PATCH', `/api/teams/${team.id}/members/${helper.id}`, {
    token: organiser.token,
    body: { role: 'athlete' },
  });
  const lastCoach = await call('PATCH', `/api/teams/${team.id}/members/${organiser.id}`, {
    token: organiser.token,
    body: { role: 'athlete' },
  });
  check('the last coach cannot step down', lastCoach.status === 400, `got ${lastCoach.status}`);

  /* ------------------------------------------------------------ who sees it */

  console.log('\n who can see it');
  const asOutsider = await call('GET', `/api/events/${event.id}`, { token: outsider.token });
  check('an outsider sees nothing', asOutsider.status === 403, `got ${asOutsider.status}`);

  const missing = await call('GET', '/api/events/00000000-0000-0000-0000-000000000000', {
    token: outsider.token,
  });
  check('a missing event answers the same as a private one', missing.status === 403, `got ${missing.status}`);

  const asCamper = await call('GET', `/api/events/${event.id}`, { token: kid.token });
  check('a camper can read the event', asCamper.status === 200, `got ${asCamper.status}`);
  check('and sees the roster', Array.isArray(asCamper.body?.roster) && asCamper.body.roster.length === 5,
    String(asCamper.body?.roster?.length));
  check('with no email on it', !asCamper.body.roster.some((row) => 'email' in row));

  const mine = await call('GET', '/api/events', { token: kid.token });
  check('and lists it among theirs', mine.body?.events?.some((row) => row.event.id === event.id));
  const notMine = await call('GET', '/api/events', { token: outsider.token });
  check('somebody in none gets an empty list', notMine.body?.events?.length === 0,
    String(notMine.body?.events?.length));
  check('an ordinary team is not an event', !mine.body.events.some((row) => row.team.id === plainTeam.id));

  const teamList = await call('GET', '/api/teams', { token: kid.token });
  check('and an event is not listed twice as a squad',
    !teamList.body.teams.some((row) => row.team.id === team.id),
    JSON.stringify(teamList.body.teams.map((row) => row.team.name)));
  const organiserTeams = await call('GET', '/api/teams', { token: organiser.token });
  check('while an ordinary team still lists',
    organiserTeams.body.teams.some((row) => row.team.id === plainTeam.id));

  /* -------------------------------------------------------------- editing */

  console.log('\n editing');
  const byCamper = await call('PATCH', `/api/events/${event.id}`, {
    token: kid.token,
    body: camp({ capacity: 100 }),
  });
  check('a camper cannot resize the camp', byCamper.status === 403, `got ${byCamper.status}`);

  const resized = await call('PATCH', `/api/events/${event.id}`, {
    token: organiser.token,
    body: camp({ capacity: 40, name: 'Summer Camp 2026' }),
  });
  check('staff can', resized.status === 200 && resized.body.event.capacity === 40, `got ${resized.status}`);
  check('and renaming it renames the team', resized.body?.team?.name === 'Summer Camp 2026',
    resized.body?.team?.name);

  const admitted = await call('PATCH', `/api/teams/${team.id}/members/${third.id}`, {
    token: organiser.token,
    body: { status: 'active' },
  });
  check('raising the ceiling lets the waiting one in',
    admitted.body?.membership?.status === 'active', JSON.stringify(admitted.body));

  const shrunk = await call('PATCH', `/api/events/${event.id}`, {
    token: organiser.token,
    body: camp({ capacity: 1 }),
  });
  check('capacity can go below the number already in', shrunk.status === 200, `got ${shrunk.status}`);
  const stillThere = await call('GET', `/api/events/${event.id}`, { token: kid.token });
  check('and removes nobody', stillThere.body?.counts?.campers === 4,
    JSON.stringify(stillThere.body?.counts));
} catch (error) {
  failures += 1;
  console.error('\n  [FAIL] test run threw —', error.message);
} finally {
  server.kill();
  await fs.rm(dbFile, { force: true });
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
