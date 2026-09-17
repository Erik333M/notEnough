/**
 * Presentation screenshots.
 *   node e2e/shots.mjs
 *
 *   npm run web            # app on :8081
 *   cd server && npm start # API on :4137
 *
 * Not a test — nothing here asserts. It seeds a believable squad through the
 * API and photographs the result into docs/screenshots/, which is the one
 * screenshot directory the repository tracks.
 *
 * Seeded rather than hand-posed, because a screenshot of an empty state sells
 * nothing and a screenshot of "Test Team / user1" sells less. Everything below
 * goes through the same endpoints the app uses, so the pictures cannot show a
 * state the app could not actually reach.
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const APP = process.env.APP_URL ?? 'http://localhost:8081';
const API = process.env.API_URL ?? 'http://localhost:4137';
const SHOTS = path.join(process.cwd(), 'docs', 'screenshots');

fs.mkdirSync(SHOTS, { recursive: true });

const stamp = Date.now();
const PASSWORD = 'strongpass1';

const COACH = { name: 'Ada Whitfield', email: `ada-${stamp}@demo.local` };
const SQUAD = [
  { name: 'Bo Nakamura', email: `bo-${stamp}@demo.local`, score: 46 },
  { name: 'Rae Okafor', email: `rae-${stamp}@demo.local`, score: 41 },
  { name: 'Milo Fontaine', email: `milo-${stamp}@demo.local`, score: 38 },
  { name: 'Iris Bergman', email: `iris-${stamp}@demo.local`, score: 29 },
];

async function api(method, endpoint, { token, body } = {}) {
  const response = await fetch(`${API}${endpoint}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function register(person) {
  const created = await api('POST', '/api/auth/register', {
    body: { name: person.name, email: person.email, password: PASSWORD },
  });
  return { ...person, token: created.token, id: created.user.id };
}

const day = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
};

/** A month of 3 Victories with realistic gaps — nobody wins every day. */
function seedVictories(wonDays) {
  const log = {};
  for (let back = 0; back < 28; back += 1) {
    const key = day(-back);
    const strong = wonDays.includes(back);
    const partial = !strong && back % 3 !== 0;
    log[key] = {
      physical: { hygiene: true, strength: strong || partial, recovery: strong },
      mind: { deepWork: strong || partial, learn: strong, reflection: strong },
      spiritual: { prayer: true, scripture: strong, faith: strong || partial },
    };
  }
  return log;
}

console.log(`\nSeeding a squad against ${API}\n`);

const coach = await register(COACH);
const squad = [];
for (const person of SQUAD) squad.push(await register(person));

const { team } = await api('POST', '/api/teams', {
  token: coach.token,
  body: { name: 'Thursday Squad', notes: 'Senior group · Tuesdays and Thursdays' },
});
for (const person of squad) {
  await api('POST', '/api/teams/join', { token: person.token, body: { code: team.inviteCode } });
}

/* --------------------------------------------------------------- a session */

const { session } = await api('POST', '/api/sessions', {
  token: coach.token,
  body: { teamId: team.id, name: 'Threshold intervals', date: day(0) },
});
const tasks = [];
for (const task of [
  { title: '6 × 800m', detail: '2 min float between reps', kind: 'minutes', target: 32 },
  { title: 'Core circuit', detail: 'Three rounds, no rest', kind: 'reps', target: 60 },
  { title: 'Mobility', detail: 'Hips and ankles', kind: 'check', target: 1 },
]) {
  const created = await api('POST', `/api/sessions/${session.id}/tasks`, {
    token: coach.token,
    body: task,
  });
  tasks.push(created.task);
}
await api('POST', `/api/sessions/${session.id}/handout`, {
  token: coach.token,
  body: { assigneeUserIds: squad.map((person) => person.id) },
});

// Partly done, the way a real session looks mid-week.
const done = [
  [0, [0, 1, 2]],
  [1, [0, 1]],
  [2, [0]],
  [3, [0, 2]],
];
for (const [personIndex, taskIndexes] of done) {
  const person = squad[personIndex];
  const mine = (await api('GET', '/api/work/mine', { token: person.token })).assignments;
  for (const taskIndex of taskIndexes) {
    const row = mine.find((entry) => entry.taskId === tasks[taskIndex].id);
    if (!row) continue;
    const short = personIndex === 2 && taskIndex === 0;
    await api('PUT', `/api/work/assignments/${row.id}/result`, {
      token: person.token,
      body: { amount: short ? 28 : row.target, done: true, notes: '' },
    });
  }
}

/* ------------------------------------------------------------- a challenge */

const firstOfMonth = `${day(0).slice(0, 8)}01`;
const { challenge } = await api('POST', `/api/teams/${team.id}/challenges`, {
  token: coach.token,
  body: {
    scope: 'monthly',
    title: 'September: three a day',
    description: '',
    reward: 'Winner picks next month’s session',
    target: 90,
    periodStart: firstOfMonth,
    periodEnd: `${day(0).slice(0, 8)}30`,
  },
});
for (const person of squad) {
  await api('POST', `/api/teams/detail/${challenge.id}/join`, { token: person.token });
  await api('PUT', `/api/teams/detail/${challenge.id}/score`, {
    token: person.token,
    body: { score: person.score },
  });
}

/* ------------------------------------------------------------- the wall */

await api('POST', `/api/teams/${team.id}/shares`, {
  token: squad[1].token,
  body: {
    kind: 'personalBest',
    achievementId: 'pb:deadlift',
    title: 'New best: Deadlift',
    detail: '92.5 kg, up from 87.5 kg',
    value: 92.5,
    achievedAt: day(-2),
    note: 'Third attempt. Finally.',
  },
});
await api('POST', `/api/teams/${team.id}/shares`, {
  token: squad[0].token,
  body: {
    kind: 'streak',
    achievementId: 'streak:14',
    title: '14 day streak',
    detail: 'Turning up, day after day.',
    value: 14,
    achievedAt: day(0),
    note: '',
  },
});

// Bo gets a real month of victories, so his own screens are not empty.
await api('PUT', '/api/state', {
  token: squad[0].token,
  body: {
    version: 1,
    goals: [],
    log: {},
    runs: [],
    plan: {},
    victories: { targets: {}, log: seedVictories([0, 1, 2, 4, 5, 7, 8, 9, 11, 12, 14, 15, 18, 21, 22, 25]) },
    updatedAt: Date.now(),
  },
});

console.log('Seeded. Capturing…\n');

/* ------------------------------------------------------------- capture */

const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function open(person) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 900 },
    // 560 CSS px wide once captured — what the README's three-column tables
    // show, and enough to stay crisp on a retina screen.
    deviceScaleFactor: 1.36,
  });
  const page = await context.newPage();
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.getByText('NOTenough').first().waitFor({ timeout: 30000 });
  await page.getByText('Sign in', { exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder('you@example.com').fill(person.email);
  await page.getByPlaceholder('At least 6 characters').fill(PASSWORD);
  await page.getByText('Sign in', { exact: true }).last().click();
  await page.waitForTimeout(3000);
  return page;
}

/**
 * Captures at the width the README actually renders, as JPEG.
 *
 * These are dark UI with large gradients, which PNG stores badly: the same
 * nineteen shots came to 7.9 MB as full-scale PNGs and 1.8 MB this way, with
 * no visible difference at the size a reader sees. A README nobody waits for
 * is worth more than pixels nobody looks at.
 */
async function shot(page, name) {
  try {
    await page.screenshot({
      path: path.join(SHOTS, `${name}.jpg`),
      type: 'jpeg',
      quality: 82,
      timeout: 10000,
    });
    console.log(`  ${name}.jpg`);
  } catch {
    console.log(`  [warn] ${name} timed out`);
  }
}

/** Scrolls the page so a section below the fold can be photographed. */
async function scroll(page, distance) {
  await page.mouse.move(206, 500);
  await page.mouse.wheel(0, distance);
  await page.waitForTimeout(900);
}

/** Switches tab. Forced, because everything here is spring-animated. */
async function tab(page, label) {
  await page.getByText(label, { exact: true }).last().click({ force: true });
  await page.waitForTimeout(1800);
}

const coachPage = await open(coach);
await shot(coachPage, '09-intent');
await coachPage.getByText('Coach others', { exact: true }).click({ force: true });
await coachPage.waitForTimeout(2000);
await coachPage.getByText('Cancel', { exact: true }).last().click({ force: true });
await coachPage.waitForTimeout(1200);
await shot(coachPage, '10-teams');

await coachPage.getByText('Thursday Squad', { exact: true }).first().click({ force: true });
await coachPage.waitForTimeout(2500);
await shot(coachPage, '11-team-coach');

// The wall and roster sit below the fold on a team with real content in it.
await scroll(coachPage, 1100);
await shot(coachPage, '18-team-wall');
await scroll(coachPage, -1100);

await coachPage.getByText('September: three a day', { exact: true }).first().click({ force: true });
await coachPage.waitForTimeout(2200);
await shot(coachPage, '12-challenge-board');

await coachPage.getByLabel('Back to the team').click({ force: true });
await coachPage.waitForTimeout(1600);
await coachPage.getByText('Threshold intervals', { exact: true }).first().click({ force: true });
await coachPage.waitForTimeout(2200);
await shot(coachPage, '13-session-builder');
// The squad's progress is the point of this screen, and it is below the fold.
await scroll(coachPage, 1000);
await shot(coachPage, '19-session-progress');

const athletePage = await open(squad[0]);
await athletePage.getByText('Train with a coach', { exact: true }).click({ force: true });
await athletePage.waitForTimeout(1500);
await athletePage.getByText('Cancel', { exact: true }).last().click({ force: true });
await athletePage.waitForTimeout(1000);
await tab(athletePage, 'Home');
await athletePage.waitForTimeout(700);
await shot(athletePage, '14-athlete-today');

await tab(athletePage, 'Home');
await athletePage.getByText('3 Victories', { exact: true }).first().click({ force: true });
await athletePage.waitForTimeout(2200);
await shot(athletePage, '15-victories');

await tab(athletePage, 'Teams');
await athletePage.getByText('Thursday Squad', { exact: true }).first().click({ force: true });
await athletePage.waitForTimeout(2500);
await shot(athletePage, '16-team-athlete');

await athletePage.getByLabel('What your coach can see').click({ force: true });
await athletePage.waitForTimeout(1800);
await shot(athletePage, '17-visibility');

await browser.close();
console.log(`\nDone. ${SHOTS}\n`);
