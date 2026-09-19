/**
 * Custom stat fields, games between squads, and the table they produce.
 *   node scripts/event-games.test.js
 *
 * The feature's whole point is that the organiser decides what is counted, so
 * most of these checks are about the edges that freedom opens up:
 *
 *  1. A field is per team or per player, and a value cannot be recorded
 *     against the wrong one — a player must never land in the standings.
 *  2. The result field can be renamed but not removed, or the table has
 *     nothing to sort by.
 *  3. A fixture is not a nil-nil draw until somebody says it was played.
 *  4. Only staff can record anything; everybody at the camp can read it.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PORT = 4199;
const base = `http://localhost:${PORT}`;
const dbFile = path.join(os.tmpdir(), `notenough-games-${Date.now()}.json`);

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
  console.log('\nGame and stat tests\n');

  const boss = await signUp('Boss');
  const ann = await signUp('Ann');
  const ben = await signUp('Ben');
  const outsider = await signUp('Outsider');

  const made = await call('POST', '/api/events', {
    token: boss.token,
    body: {
      name: 'Football Camp',
      startDate: '2026-07-01',
      endDate: '2026-07-10',
      ageMin: 10,
      ageMax: 14,
      capacity: 20,
      staffTarget: 1,
    },
  });
  const event = made.body.event;
  const campCode = made.body.team.inviteCode;
  for (const who of [ann, ben]) {
    await call('POST', '/api/teams/join', { token: who.token, body: { code: campCode } });
  }

  const squad = async (name) =>
    (await call('POST', `/api/events/${event.id}/teams`, { token: boss.token, body: { name } })).body
      .team;
  const red = await squad('Red');
  const blue = await squad('Blue');
  await call('PUT', `/api/events/${event.id}/teams/${red.id}/members/${ann.id}`, { token: boss.token });
  await call('PUT', `/api/events/${event.id}/teams/${blue.id}/members/${ben.id}`, { token: boss.token });

  /* ---------------------------------------------------------- the schema */

  console.log(' what the event counts');
  const initial = await call('GET', `/api/events/${event.id}/fields`, { token: boss.token });
  check('an event starts with a result field', initial.body?.fields?.length === 1,
    JSON.stringify(initial.body?.fields));
  const score = initial.body.fields[0];
  check('which is a team field', score.scope === 'team' && score.isScore === true, JSON.stringify(score));

  const addField = (label, scope, token = boss.token) =>
    call('POST', `/api/events/${event.id}/fields`, { token, body: { label, scope } });

  const goals = (await addField('Goals', 'player')).body.field;
  const assists = (await addField('Assists', 'player')).body.field;
  const cards = (await addField('Yellow cards', 'player')).body.field;
  const possession = (await addField('Possession %', 'team')).body.field;
  check('staff can add a player field', goals?.scope === 'player', JSON.stringify(goals));
  check('and a team one', possession?.scope === 'team');
  check('a new field never decides results', [goals, assists, cards, possession].every((f) => !f.isScore));

  const byCamper = await addField('Sneaky', 'player', ann.token);
  check('a camper cannot add a field', byCamper.status === 403, `got ${byCamper.status}`);

  const dupe = await addField('goals', 'player');
  check('two fields cannot share a name', dupe.status === 400, `got ${dupe.status}`);

  const nonsense = await call('POST', `/api/events/${event.id}/fields`, {
    token: boss.token,
    body: { label: 'Vibes', scope: 'weather' },
  });
  check('a field counts a team or a player, nothing else', nonsense.status === 400, `got ${nonsense.status}`);

  const renamed = await call('PATCH', `/api/events/${event.id}/fields/${cards.id}`, {
    token: boss.token,
    body: { label: 'Bookings' },
  });
  check('a field can be renamed', renamed.body?.field?.label === 'Bookings', renamed.body?.field?.label);

  const killScore = await call('PATCH', `/api/events/${event.id}/fields/${score.id}`, {
    token: boss.token,
    body: { archived: true },
  });
  check('the result field cannot be removed', killScore.status === 400, `got ${killScore.status}`);
  const renameScore = await call('PATCH', `/api/events/${event.id}/fields/${score.id}`, {
    token: boss.token,
    body: { label: 'Goals scored' },
  });
  check('but it can be renamed', renameScore.body?.field?.label === 'Goals scored');

  const dropped = await call('PATCH', `/api/events/${event.id}/fields/${assists.id}`, {
    token: boss.token,
    body: { archived: true },
  });
  check('any other field can be dropped', dropped.status === 200, `got ${dropped.status}`);
  const afterDrop = await call('GET', `/api/events/${event.id}/fields`, { token: ann.token });
  check('and it leaves the list', !afterDrop.body.fields.some((row) => row.id === assists.id));
  check('campers can read what is counted', afterDrop.status === 200);
  check('but are not offered the controls', afterDrop.body.canManage === false);

  /* ----------------------------------------------------------- fixtures */

  console.log('\n fixtures');
  const newGame = (body, token = boss.token) =>
    call('POST', `/api/events/${event.id}/games`, { token, body });

  const itself = await newGame({ homeTeamId: red.id, awayTeamId: red.id, playedOn: '2026-07-02' });
  check('a squad cannot play itself', itself.status === 400, `got ${itself.status}`);

  const elsewhere = await newGame({
    homeTeamId: red.id,
    awayTeamId: 'some-other-team',
    playedOn: '2026-07-02',
  });
  check('and cannot play a team from outside', elsewhere.status === 400, `got ${elsewhere.status}`);

  const byAnn = await newGame(
    { homeTeamId: red.id, awayTeamId: blue.id, playedOn: '2026-07-02' },
    ann.token,
  );
  check('a camper cannot add a fixture', byAnn.status === 403, `got ${byAnn.status}`);

  const game = (await newGame({
    homeTeamId: red.id,
    awayTeamId: blue.id,
    playedOn: '2026-07-02',
    title: 'Opening match',
  })).body.game;
  check('staff can', Boolean(game?.id));
  check('and it starts merely scheduled', game.status === 'scheduled', game.status);

  const beforePlay = await call('GET', `/api/events/${event.id}/games`, { token: ann.token });
  const redBefore = beforePlay.body.standings.find((row) => row.teamId === red.id);
  check('a fixture is not a nil-nil draw', redBefore?.played === 0, JSON.stringify(redBefore));

  /* ------------------------------------------------------------ results */

  console.log('\n recording a result');
  const save = (entries, token = boss.token, status = 'played') =>
    call('PUT', `/api/events/${event.id}/games/${game.id}/stats`, {
      token,
      body: { entries, status },
    });

  const wrongScope = await save([
    { teamId: red.id, userId: ann.id, fieldId: score.id, value: 3 },
  ]);
  check('a team total cannot be pinned on a player', wrongScope.status === 400, `got ${wrongScope.status}`);

  const alsoWrong = await save([{ teamId: red.id, userId: null, fieldId: goals.id, value: 3 }]);
  check('nor a player figure on a team', alsoWrong.status === 400, `got ${alsoWrong.status}`);

  const notPlaying = await save([
    { teamId: 'ghost-team', userId: null, fieldId: score.id, value: 1 },
  ]);
  check('nor anything on a squad that is not playing', notPlaying.status === 400, `got ${notPlaying.status}`);

  const unknownField = await save([
    { teamId: red.id, userId: null, fieldId: 'made-up', value: 1 },
  ]);
  check('nor against a field that does not exist', unknownField.status === 400, `got ${unknownField.status}`);

  const twice = await save([
    { teamId: red.id, userId: null, fieldId: score.id, value: 1 },
    { teamId: red.id, userId: null, fieldId: score.id, value: 2 },
  ]);
  check('the same figure cannot be sent twice', twice.status === 400, `got ${twice.status}`);

  const byCamperSave = await save(
    [{ teamId: red.id, userId: null, fieldId: score.id, value: 99 }],
    ann.token,
  );
  check('a camper cannot record a result', byCamperSave.status === 403, `got ${byCamperSave.status}`);

  const saved = await save([
    { teamId: red.id, userId: null, fieldId: score.id, value: 3 },
    { teamId: blue.id, userId: null, fieldId: score.id, value: 1 },
    { teamId: red.id, userId: ann.id, fieldId: goals.id, value: 2 },
    { teamId: blue.id, userId: ben.id, fieldId: goals.id, value: 1 },
    { teamId: blue.id, userId: ben.id, fieldId: cards.id, value: 1 },
    { teamId: red.id, userId: null, fieldId: possession.id, value: 62 },
  ]);
  check('staff can record the lot in one go', saved.status === 200, `got ${saved.status}`);
  check('and the game is played', saved.body?.game?.status === 'played');

  const after = await call('GET', `/api/events/${event.id}/games`, { token: ann.token });
  const table = after.body.standings;
  check('the winner tops the table', table[0]?.teamId === red.id, JSON.stringify(table));
  check('with three points', table[0]?.points === 3, String(table[0]?.points));
  check('and a difference of two', table[0]?.difference === 2, String(table[0]?.difference));
  check('the loser has none', table[1]?.points === 0 && table[1]?.lost === 1, JSON.stringify(table[1]));

  const scorers = after.body.leaders.find((row) => row.field.id === goals.id);
  check('the top scorer is named', scorers?.rows?.[0]?.name === 'Ann', JSON.stringify(scorers?.rows));
  check('with their total', scorers?.rows?.[0]?.value === 2);
  check('a dropped field has no leaderboard', !after.body.leaders.some((row) => row.field.id === assists.id));
  check('campers can read the table', after.status === 200);

  /* ----------------------------------------------------- saving it again */

  console.log('\n correcting it');
  const corrected = await save([
    { teamId: red.id, userId: null, fieldId: score.id, value: 1 },
    { teamId: blue.id, userId: null, fieldId: score.id, value: 1 },
  ]);
  check('a re-save replaces rather than adds', corrected.body?.game?.stats?.length === 2,
    String(corrected.body?.game?.stats?.length));
  const drawn = (await call('GET', `/api/events/${event.id}/games`, { token: boss.token })).body;
  check('and the table follows', drawn.standings.every((row) => row.points === 1),
    JSON.stringify(drawn.standings.map((row) => row.points)));
  check('the old player figures went with it',
    drawn.leaders.find((row) => row.field.id === goals.id)?.rows?.length === 0);

  /* --------------------------------------------------------- outsiders */

  console.log('\n who can see any of it');
  const nosy = await call('GET', `/api/events/${event.id}/games`, { token: outsider.token });
  check('somebody outside the camp sees nothing', nosy.status === 403, `got ${nosy.status}`);
  const nosyFields = await call('GET', `/api/events/${event.id}/fields`, { token: outsider.token });
  check('not even what is counted', nosyFields.status === 403, `got ${nosyFields.status}`);

  /* ------------------------------------------------------ calling it off */

  console.log('\n calling a game off');
  const byAnnDelete = await call('DELETE', `/api/events/${event.id}/games/${game.id}`, {
    token: ann.token,
  });
  check('a camper cannot', byAnnDelete.status === 403, `got ${byAnnDelete.status}`);
  const deleted = await call('DELETE', `/api/events/${event.id}/games/${game.id}`, {
    token: boss.token,
  });
  check('staff can', deleted.status === 204, `got ${deleted.status}`);
  const empty = (await call('GET', `/api/events/${event.id}/games`, { token: boss.token })).body;
  check('the fixture goes', empty.games.length === 0, String(empty.games.length));
  check('its numbers go with it', empty.standings.every((row) => row.played === 0));
} catch (error) {
  failures += 1;
  console.error('\n  [FAIL] test run threw —', error.message);
} finally {
  server.kill();
  await fs.rm(dbFile, { force: true });
}

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
