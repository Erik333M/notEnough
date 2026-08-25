/**
 * End-to-end smoke test against a running server.
 *   node scripts/smoke.js [baseUrl]
 *
 * Exercises the full contract the mobile app depends on: register, duplicate
 * rejection, login, bad password, /me, state push, state pull, and the stale
 * write conflict rule.
 */

const base = process.argv[2] ?? 'http://localhost:4000';
let failures = 0;

function check(label, condition, detail = '') {
  const mark = condition ? 'PASS' : 'FAIL';
  if (!condition) failures += 1;
  console.log(`  [${mark}] ${label}${detail && !condition ? ` — ${detail}` : ''}`);
}

async function call(method, path, { token, body } = {}) {
  const response = await fetch(`${base}${path}`, {
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

const email = `smoke-${Date.now()}@example.com`;
const password = 'runfast123';

console.log(`\nSmoke testing ${base}\n`);

const health = await call('GET', '/api/health');
check('health returns ok', health.status === 200 && health.body?.ok === true, JSON.stringify(health.body));

const registered = await call('POST', '/api/auth/register', {
  body: { name: 'Smoke Runner', email, password },
});
check('register returns 201 + token', registered.status === 201 && Boolean(registered.body?.token));
check('register never returns the hash', registered.body?.user?.hash === undefined);

const duplicate = await call('POST', '/api/auth/register', {
  body: { name: 'Smoke Runner', email, password },
});
check('duplicate email rejected with 409', duplicate.status === 409, `got ${duplicate.status}`);

const shortPassword = await call('POST', '/api/auth/register', {
  body: { name: 'Nope', email: `x-${Date.now()}@example.com`, password: '123' },
});
check(
  'short password rejected with field tag',
  shortPassword.status === 400 && shortPassword.body?.field === 'password',
);

const login = await call('POST', '/api/auth/login', { body: { email, password } });
check('login succeeds', login.status === 200 && Boolean(login.body?.token));

const wrong = await call('POST', '/api/auth/login', { body: { email, password: 'wrongpass' } });
check('wrong password rejected with 401', wrong.status === 401, `got ${wrong.status}`);

const unknown = await call('POST', '/api/auth/login', {
  body: { email: `ghost-${Date.now()}@example.com`, password },
});
check(
  'unknown account is indistinguishable from wrong password',
  unknown.status === wrong.status && unknown.body?.message === wrong.body?.message,
);

const token = login.body.token;

const noAuth = await call('GET', '/api/state');
check('state requires auth', noAuth.status === 401);

const me = await call('GET', '/api/auth/me', { token });
check('me returns the profile', me.status === 200 && me.body?.user?.email === email);

const renamed = await call('PATCH', '/api/auth/me', { token, body: { name: 'Renamed Runner' } });
check('rename updates the profile', renamed.status === 200 && renamed.body?.user?.name === 'Renamed Runner');

const badRename = await call('PATCH', '/api/auth/me', { token, body: { name: 'x' } });
check('rename rejects a too-short name', badRename.status === 400 && badRename.body?.field === 'name');

const afterRename = await call('GET', '/api/auth/me', { token });
check('rename persisted', afterRename.body?.user?.name === 'Renamed Runner');

const emptyState = await call('GET', '/api/state', { token });
check('new account starts with null state', emptyState.status === 200 && emptyState.body?.state === null);

const now = Date.now();
const payload = {
  version: 1,
  goals: [{ id: 'g1', title: 'Easy run', target: 5000 }],
  log: { '2026-07-26': { g1: 2500 } },
  runs: [],
  plan: { hoursPerDay: 1, daysPerWeek: 5 },
  updatedAt: now,
};

const pushed = await call('PUT', '/api/state', { token, body: payload });
check('state push accepted', pushed.status === 200 && pushed.body?.state?.goals?.length === 1);

const pulled = await call('GET', '/api/state', { token });
check('state pull returns what was pushed', pulled.body?.state?.log?.['2026-07-26']?.g1 === 2500);

const stale = await call('PUT', '/api/state', {
  token,
  body: { ...payload, goals: [], updatedAt: now - 60_000 },
});
check('stale write rejected with 409', stale.status === 409, `got ${stale.status}`);

const afterStale = await call('GET', '/api/state', { token });
check('stale write did not clobber stored data', afterStale.body?.state?.goals?.length === 1);

const newer = await call('PUT', '/api/state', {
  token,
  body: { ...payload, goals: [], updatedAt: now + 60_000 },
});
check('newer write accepted', newer.status === 200 && newer.body?.state?.goals?.length === 0);

const badPayload = await call('PUT', '/api/state', { token, body: { goals: 'nope' } });
check('malformed state rejected with 400', badPayload.status === 400);

// 3 Victories. The payload is whitelisted field by field on the way in, so a
// new key that nobody added to the validator is dropped in silence and the
// user's history quietly stops syncing — worth asserting, not assuming.
const victories = {
  targets: { strength: '30 push-ups' },
  log: {
    '2026-07-26': {
      physical: { hygiene: true, strength: false, recovery: true },
      mind: { deepWork: true, learn: true, reflection: false },
      spiritual: { prayer: true, scripture: false, faith: true },
    },
  },
};

const withVictories = await call('PUT', '/api/state', {
  token,
  body: { ...payload, victories, updatedAt: now + 120_000 },
});
check('victories accepted on push', withVictories.status === 200);

const pulledVictories = await call('GET', '/api/state', { token });
check(
  'victories survive a round trip',
  pulledVictories.body?.state?.victories?.log?.['2026-07-26']?.physical?.hygiene === true &&
    pulledVictories.body?.state?.victories?.targets?.strength === '30 push-ups',
);

const olderClient = await call('PUT', '/api/state', {
  token,
  body: { ...payload, updatedAt: now + 180_000 },
});
check('state without victories is still accepted', olderClient.status === 200);

const badVictories = await call('PUT', '/api/state', {
  token,
  body: { ...payload, victories: { log: 'nope' }, updatedAt: now + 240_000 },
});
check('malformed victories rejected with 400', badVictories.status === 400);

const deleted = await call('DELETE', '/api/auth/me', { token });
check('account delete returns 204', deleted.status === 204);

const afterDelete = await call('GET', '/api/auth/me', { token });
check('token is dead after account delete', afterDelete.status === 401);

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
